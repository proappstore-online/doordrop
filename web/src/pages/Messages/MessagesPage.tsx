import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useUserData } from "../../hooks/useUserData";
import { ChatRepository } from "../../repositories/chatRepository";
import { CampaignRepository } from "../../repositories/campaignRepository";
import type { CampaignNote } from "../../repositories/campaignNoteRepository";
import type { CampaignData } from "../../models/campaign";
import type { ChatReadState } from "../../models/chatReadState";

type CampaignWithId = CampaignData & { id: string };

interface ConversationPreview {
  campaign: CampaignWithId;
  lastMessage: CampaignNote | null;
  unread: boolean;
}

const timeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const MessagesPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuthContext();
  const { userData } = useUserData();

  const basePath = location.pathname.startsWith("/walker") ? "/walker" : "/app";

  const [campaigns, setCampaigns] = useState<CampaignWithId[]>([]);
  const [readStates, setReadStates] = useState<Record<string, ChatReadState>>({});
  const [previews, setPreviews] = useState<ConversationPreview[]>([]);
  const [messages, setMessages] = useState<CampaignNote[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Responsive check
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // TODO(task #10): replace 10s polling with a realtime subscription.
  useEffect(() => {
    if (!currentUser || !userData?.role) return;
    let cancelled = false;
    const load = async () => {
      try {
        const list =
          userData.role === "walker"
            ? await CampaignRepository.getCampaignsByAssignedWalker(currentUser.id)
            : await CampaignRepository.getCampaignsByUser(currentUser.id);
        if (!cancelled) setCampaigns(list);
      } catch {
        /* next tick retries */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentUser, userData?.role]);

  // Subscribe to read states
  useEffect(() => {
    if (!currentUser) return;
    return ChatRepository.subscribeToReadStates(currentUser.id, setReadStates);
  }, [currentUser]);

  // Build conversation previews
  useEffect(() => {
    if (campaigns.length === 0) {
      setPreviews([]);
      return;
    }

    let cancelled = false;
    async function load() {
      const results = await Promise.all(
        campaigns.map(async (c) => {
          const lastMessage = await ChatRepository.getLatestMessage(c.id);
          const readState = readStates[c.id];
          const unread = lastMessage
            ? !readState || lastMessage.createdAt > readState.lastReadAt
            : false;
          return { campaign: c, lastMessage, unread };
        })
      );
      if (!cancelled) {
        // Sort: unread first, then by latest message time desc
        results.sort((a, b) => {
          if (a.unread !== b.unread) return a.unread ? -1 : 1;
          const aTime = a.lastMessage?.createdAt.getTime() ?? 0;
          const bTime = b.lastMessage?.createdAt.getTime() ?? 0;
          return bTime - aTime;
        });
        setPreviews(results);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [campaigns, readStates]);

  // Subscribe to messages for selected campaign
  useEffect(() => {
    if (!campaignId) {
      setMessages([]);
      return;
    }
    return ChatRepository.subscribeToMessages(campaignId, setMessages);
  }, [campaignId]);

  // Mark as read when opening a conversation
  useEffect(() => {
    if (!campaignId || !currentUser) return;
    ChatRepository.markAsRead(currentUser.id, campaignId);
  }, [campaignId, currentUser]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !campaignId || !currentUser || !userData) return;

    setSending(true);
    const displayName = userData.name || currentUser.login || "Unknown";
    await ChatRepository.sendMessage(campaignId, newMessage.trim(), displayName, currentUser.id);
    setNewMessage("");
    setSending(false);
    // Update read state after sending
    ChatRepository.markAsRead(currentUser.id, campaignId);
  };

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  // Mobile: if campaignId is set, show chat full-screen
  if (isMobile && campaignId) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden -mx-4 -my-6">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => navigate(`${basePath}/messages`)}
            className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-semibold text-gray-900 dark:text-white truncate">
            {selectedCampaign?.name || "Chat"}
          </h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
          {messages.map((msg) => {
            const isOwn = msg.userId === currentUser?.id;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isOwn
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {!isOwn && (
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                      {msg.userName}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${isOwn ? "text-emerald-200" : "text-gray-400"}`}>
                    {timeAgo(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    );
  }

  // Desktop two-panel layout / Mobile conversation list
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden -mx-4 -my-6">
      {/* Conversation list */}
      <div className={`${isMobile ? "w-full" : "w-80 border-r border-gray-200 dark:border-gray-700"} bg-white dark:bg-gray-800 flex flex-col`}>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {previews.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
              No conversations yet
            </div>
          ) : (
            previews.map((p) => {
              const isSelected = p.campaign.id === campaignId;
              return (
                <button
                  key={p.campaign.id}
                  onClick={() => navigate(`${basePath}/messages/${p.campaign.id}`)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 transition-colors ${
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                      {p.campaign.name}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.lastMessage && (
                        <span className="text-xs text-gray-400">{timeAgo(p.lastMessage.createdAt)}</span>
                      )}
                      {p.unread && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                    </div>
                  </div>
                  {p.lastMessage && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                      {p.lastMessage.userName}: {p.lastMessage.text}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat panel (desktop only) */}
      {!isMobile && (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
          {!campaignId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm">Select a conversation to start chatting</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {selectedCampaign?.name || "Chat"}
                </h2>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isOwn = msg.userId === currentUser?.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[60%] rounded-2xl px-4 py-2 ${
                          isOwn
                            ? "bg-emerald-600 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        {!isOwn && (
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                            {msg.userName}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${isOwn ? "text-emerald-200" : "text-gray-400"}`}>
                          {timeAgo(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
