import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUnreadMessages } from "../../hooks/useUnreadMessages";

const MessagesBadge: React.FC = () => {
  const { totalUnread } = useUnreadMessages();
  const navigate = useNavigate();
  const location = useLocation();

  const basePath = location.pathname.startsWith("/walker") ? "/walker" : "/app";

  return (
    <button
      onClick={() => navigate(`${basePath}/messages`)}
      className="relative p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
      aria-label="Messages"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      {totalUnread > 0 && (
        <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {totalUnread > 9 ? "9+" : totalUnread}
        </span>
      )}
    </button>
  );
};

export default MessagesBadge;
