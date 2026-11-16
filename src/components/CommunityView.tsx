import React, { useState } from 'react';
import { ArrowBigUp, MessageSquare, Plus, Send } from 'lucide-react';
import { CommunityThread } from '../types';

interface CommunityViewProps {
  threads: CommunityThread[];
  canPost?: boolean;
  communityEnabled?: boolean;
  onRequireAuth?: () => void;
  onCreateThread: (input: {
    title: string;
    topic: CommunityThread['topic'];
    body: string;
  }) => void;
  onToggleUpvote: (threadId: string) => void;
  onAddReply: (threadId: string, content: string) => void;
}

const TOPICS: Array<'All' | CommunityThread['topic']> = [
  'All',
  'Plugins Help',
  'Server Setups',
  'Showcase',
  'Requests',
];

export const CommunityView: React.FC<CommunityViewProps> = ({
  threads,
  canPost = true,
  communityEnabled = true,
  onRequireAuth,
  onCreateThread,
  onToggleUpvote,
  onAddReply,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<'All' | CommunityThread['topic']>('All');
  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState<CommunityThread['topic']>('Plugins Help');
  const [newBody, setNewBody] = useState('');
  const [openThreadId, setOpenThreadId] = useState<string | null>(threads[0]?.id ?? null);
  const [replyText, setReplyText] = useState('');

  const visibleThreads =
    selectedTopic === 'All'
      ? threads
      : threads.filter((t) => t.topic === selectedTopic);

  const handleSubmitThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityEnabled) return;
    if (!newTitle.trim() || !newBody.trim()) return;
    onCreateThread({
      title: newTitle.trim(),
      topic: newTopic,
      body: newBody.trim(),
    });
    setNewTitle('');
    setNewBody('');
    setComposerOpen(false);
  };

  const handleSubmitReply = (e: React.FormEvent, threadId: string) => {
    e.preventDefault();
    if (!communityEnabled) return;
    if (!replyText.trim()) return;
    onAddReply(threadId, replyText.trim());
    setReplyText('');
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            SwxStudios Community
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Troubleshoot plugin configs, share server TPS benchmarks, and request new models.
          </p>
        </div>

        <button
          type="button"
          disabled={!communityEnabled}
          onClick={() => {
            if (!communityEnabled) return;
            if (!canPost && onRequireAuth) {
              onRequireAuth();
              return;
            }
            setComposerOpen((prev) => !prev);
          }}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-white px-4 text-xs font-bold text-zinc-950 whitespace-nowrap hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>
            {!communityEnabled
              ? 'Posting Paused'
              : !canPost
              ? 'Sign In to Post'
              : composerOpen
              ? 'Close Composer'
              : 'New Thread'}
          </span>
        </button>
      </div>

      {/* New Thread Form */}
      {composerOpen && (
        <form
          onSubmit={handleSubmitThread}
          className="mt-5 rounded-xl border border-zinc-800 bg-[#111114] p-5 space-y-3.5"
        >
          <h2 className="text-sm font-bold text-white">Start a discussion</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="thread-title" className="block text-xs font-medium text-zinc-400">
                Title
              </label>
              <input
                id="thread-title"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Need help tuning DeluxeMenus cooldown placeholders"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="thread-topic" className="block text-xs font-medium text-zinc-400">
                Topic
              </label>
              <select
                id="thread-topic"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value as CommunityThread['topic'])}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
              >
                <option value="Plugins Help">Plugins Help</option>
                <option value="Server Setups">Server Setups</option>
                <option value="Showcase">Showcase</option>
                <option value="Requests">Requests</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="thread-body" className="block text-xs font-medium text-zinc-400">
              Details
            </label>
            <textarea
              id="thread-body"
              rows={3}
              required
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Share your server version, plugin stack, or request details..."
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="h-9 rounded-md border border-zinc-800 px-3.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 rounded-md bg-white px-4 text-xs font-bold text-zinc-950 hover:bg-zinc-200"
            >
              Publish Thread
            </button>
          </div>
        </form>
      )}

      {/* Topic Filter Strip */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => setSelectedTopic(topic)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedTopic === topic
                ? 'bg-white text-zinc-950'
                : 'border border-zinc-800 bg-[#111114] text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Threads List */}
      <div className="mt-5 space-y-3">
        {visibleThreads.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-[#111114] p-10 text-center">
            <p className="text-sm font-semibold text-zinc-200">
              No threads posted yet.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Click &ldquo;New Thread&rdquo; to start the first discussion.
            </p>
          </div>
        ) : (
          visibleThreads.map((thread) => {
            const isOpen = openThreadId === thread.id;
            return (
              <article
                key={thread.id}
                className="rounded-xl border border-zinc-800/90 bg-[#111114] p-4 sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => onToggleUpvote(thread.id)}
                    aria-label={`Upvote thread ${thread.title}`}
                    className={`flex shrink-0 flex-col items-center rounded-md border px-2.5 py-1.5 text-xs font-bold tabular-nums transition-colors ${
                      thread.upvotedByMe
                        ? 'border-white/50 bg-white/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <ArrowBigUp className="h-4 w-4" aria-hidden="true" />
                    <span>{thread.upvotes}</span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span className="font-semibold text-zinc-200">{thread.topic}</span>
                      <span aria-hidden="true">·</span>
                      <span>{thread.author}</span>
                      <span aria-hidden="true">·</span>
                      <span>{thread.role}</span>
                      <span aria-hidden="true">·</span>
                      <span>{thread.createdAt}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenThreadId(isOpen ? null : thread.id)}
                      className="mt-1.5 text-left text-base font-bold text-white hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                      {thread.title}
                    </button>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
                      {thread.body}
                    </p>

                    <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                      <button
                        type="button"
                        onClick={() => setOpenThreadId(isOpen ? null : thread.id)}
                        className="inline-flex items-center gap-1.5 font-medium text-zinc-300 hover:text-white"
                      >
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="tabular-nums">
                          {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
                        </span>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-4 border-t border-zinc-800/80 pt-4 space-y-3">
                        {thread.replies.length === 0 ? (
                          <p className="text-xs text-zinc-500">
                            No replies yet. Share the first answer below.
                          </p>
                        ) : (
                          thread.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="rounded-lg border border-zinc-800/70 bg-zinc-950/70 p-3"
                            >
                              <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <strong className="font-semibold text-zinc-200">{reply.author}</strong>
                                <span aria-hidden="true">·</span>
                                <span>{reply.role}</span>
                                <span aria-hidden="true">·</span>
                                <span>{reply.createdAt}</span>
                              </div>
                              <p className="mt-1 text-sm text-zinc-300">{reply.content}</p>
                            </div>
                          ))
                        )}

                        <form
                          onSubmit={(e) => handleSubmitReply(e, thread.id)}
                          className="flex gap-2"
                        >
                          <label htmlFor={`reply-${thread.id}`} className="sr-only">
                            Write a reply
                          </label>
                          <input
                            id={`reply-${thread.id}`}
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a helpful reply..."
                            className="h-9 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-3.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200"
                          >
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Reply</span>
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
