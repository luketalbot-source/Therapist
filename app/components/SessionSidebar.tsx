"use client";

import { Session } from "@/lib/sessions";

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onClose,
}: SessionSidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={`
          fixed top-0 left-0 h-full w-72 bg-stone-50 z-50
          transform transition-transform duration-300 ease-in-out
          shadow-xl flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-semibold text-stone-700 text-sm">
            Conversations
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-stone-200 text-stone-500"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={() => {
              onNewSession();
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-medium
                       hover:bg-blue-700 transition-colors shadow-sm"
          >
            + New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-stone-400 text-center mt-8">
              No conversations yet
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`
                  group flex items-center gap-2 p-3 rounded-xl mb-1 cursor-pointer
                  transition-colors text-sm
                  ${
                    session.id === activeSessionId
                      ? "bg-blue-50 text-blue-800"
                      : "text-stone-600 hover:bg-stone-100"
                  }
                `}
                onClick={() => {
                  onSelectSession(session.id);
                  onClose();
                }}
              >
                <span className="flex-1 truncate">{session.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-stone-200
                             text-stone-400 hover:text-red-500 transition-all"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
