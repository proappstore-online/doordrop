import React from "react";

interface Note {
  id: string;
  text: string;
  userName: string;
  createdAt: Date;
}

interface NotesProps {
  notes: Note[];
  noteInput: string;
  noteLoading: boolean;
  onNoteChange: (val: string) => void;
  onAddNote: (e: React.FormEvent) => void;
  formatDate: (date: Date) => string;
}

const Notes: React.FC<NotesProps> = ({
  notes,
  noteInput,
  noteLoading,
  onNoteChange,
  onAddNote,
  formatDate,
}) => {
  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-lg shadow-md">
      <div className="flex flex-col h-[500px] p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Campaign Chatbox
        </h2>
        <div className="flex-1 overflow-y-auto mb-4 border dark:border-emerald-600 rounded-lg bg-white dark:bg-gray-800 p-2">
          {notes.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="mb-4">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{note.userName}</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">{note.text}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {formatDate(note.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={onAddNote} className="flex gap-2">
          <input
            type="text"
            placeholder="Write a note..."
            value={noteInput}
            onChange={(e) => onNoteChange(e.target.value)}
            disabled={noteLoading}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={noteLoading || !noteInput.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {noteLoading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Notes;
