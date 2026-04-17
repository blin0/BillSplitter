import { useState, useEffect, useRef } from 'react';
import { Check, Copy, ChevronRight, X, Users, ChevronDown, UserMinus, AlertTriangle, LogOut, Trash2, User } from 'lucide-react';
import { cn } from '../lib/cn';
import type { GroupInfo, GroupMemberInfo } from '../lib/db';
import { fetchGroupMembers, updateMemberRole, removeMember, updateGroupName, leaveGroup, deleteGroupPermanently } from '../lib/db';
import GroupActions from './GroupActions';
import ConfirmModal from './ui/ConfirmModal';

interface Props {
  groups:         GroupInfo[];
  activeGroupId:  string | null;
  currentUserId:  string | null;
  onSelect:       (id: string) => void;
  isOpen:         boolean;
  onClose:        () => void;
  onGroupAdded:   (group: GroupInfo) => void;
  onGroupRenamed: (groupId: string, newName: string) => void;
  /** Called after successfully leaving a group */
  onGroupLeft:    (groupId: string) => void;
  /** Called after successfully deleting a group */
  onGroupDeleted: (groupId: string) => void;
  /** Navigate to the Profile page */
  onOpenProfile:  () => void;
  /** Which page is currently active */
  currentPage?:   'app' | 'profile';
}

// ─── Role metadata ────────────────────────────────────────────────────────────

type Role = 'admin' | 'editor' | 'viewer';

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'admin',  label: 'Admin',  description: 'Full access + manage members' },
  { value: 'editor', label: 'Editor', description: 'Add and delete expenses'       },
  { value: 'viewer', label: 'Viewer', description: 'View only'                     },
];

const ROLE_BADGE_CLASS: Record<Role, string> = {
  admin:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  editor: 'bg-blue-100  dark:bg-blue-900/40  text-blue-700  dark:text-blue-400',
  viewer: 'bg-gray-100  dark:bg-slate-700    text-gray-500  dark:text-slate-400',
};

// ─── Inline role combobox ─────────────────────────────────────────────────────

function RoleDropdown({
  value,
  disabled,
  onChange,
}: {
  value:    Role;
  disabled: boolean;
  onChange: (r: Role) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const meta = ROLES.find(r => r.value === value)!;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all',
          ROLE_BADGE_CLASS[value],
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:brightness-95 dark:hover:brightness-110 cursor-pointer',
        )}
      >
        {meta.label}
        {!disabled && (
          <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute right-0 top-full mt-1.5 z-50',
          'w-44 rounded-xl overflow-hidden',
          'bg-white dark:bg-slate-800',
          'border border-gray-200 dark:border-slate-700',
          'shadow-lg shadow-black/10 dark:shadow-black/40',
        )}>
          {ROLES.map(role => (
            <button
              key={role.value}
              type="button"
              onClick={() => { onChange(role.value); setOpen(false); }}
              className={cn(
                'w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                role.value === value
                  ? 'bg-violet-50 dark:bg-violet-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-700',
              )}
            >
              <span className="mt-0.5 w-3 shrink-0 flex items-center justify-center">
                {role.value === value && (
                  <Check size={11} className="text-violet-600 dark:text-violet-400" />
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={cn(
                  'text-xs font-medium leading-none',
                  role.value === value
                    ? 'text-violet-700 dark:text-violet-300'
                    : 'text-gray-800 dark:text-slate-200',
                )}>
                  {role.label}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 leading-snug">
                  {role.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

function RemoveConfirmModal({
  member,
  groupName,
  onConfirm,
  onCancel,
}: {
  member:    GroupMemberInfo;
  groupName: string;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  const displayName = member.fullName ?? member.userId.slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className={cn(
        'relative w-full max-w-sm rounded-2xl p-6',
        'bg-white dark:bg-slate-900',
        'border border-gray-200 dark:border-slate-700',
        'shadow-xl shadow-black/20',
      )}>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">
          Remove member?
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
          <span className="font-medium text-gray-700 dark:text-slate-300">{displayName}</span>
          {' '}will be removed from{' '}
          <span className="font-medium text-gray-700 dark:text-slate-300">{groupName}</span>
          {' '}and will lose access immediately.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-500 active:bg-red-700 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GroupSidebar ─────────────────────────────────────────────────────────────

type ConfirmAction = 'leave' | 'delete';

export default function GroupSidebar({
  groups,
  activeGroupId,
  currentUserId,
  onSelect,
  isOpen,
  onClose,
  onGroupAdded,
  onGroupRenamed,
  onGroupLeft,
  onGroupDeleted,
  onOpenProfile,
  currentPage = 'app',
}: Props) {
  const [copied,          setCopied         ] = useState(false);
  const [groupsOpen,      setGroupsOpen     ] = useState(true);   // default expanded
  const [membersOpen,     setMembersOpen    ] = useState(false);
  const [members,         setMembers        ] = useState<GroupMemberInfo[]>([]);
  const [membersLoading,  setMembersLoading ] = useState(false);
  const [roleError,       setRoleError      ] = useState<string | null>(null);
  const [pendingRemove,   setPendingRemove  ] = useState<GroupMemberInfo | null>(null);
  const [editingGroupId,  setEditingGroupId ] = useState<string | null>(null);
  const [editingName,     setEditingName    ] = useState('');
  const [confirmAction,   setConfirmAction  ] = useState<ConfirmAction | null>(null);
  const [confirmLoading,  setConfirmLoading ] = useState(false);
  const [confirmError,    setConfirmError   ] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const isAdmin     = activeGroup?.role === 'admin';

  // Auto-focus and select the rename input when editing starts
  useEffect(() => {
    if (editingGroupId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingGroupId]);

  useEffect(() => {
    if (!activeGroupId || !isAdmin || !membersOpen) return;
    setMembersLoading(true);
    setRoleError(null);
    fetchGroupMembers(activeGroupId).then(({ data, error }) => {
      setMembersLoading(false);
      if (error) { setRoleError(error); return; }
      setMembers(data ?? []);
    });
  }, [activeGroupId, isAdmin, membersOpen]);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSelect(id: string) {
    onSelect(id);
    setMembersOpen(false);
    onClose();
  }

  function handleGroupAdded(group: GroupInfo) {
    onGroupAdded(group);
    onClose();
  }

  function startRename(group: GroupInfo) {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  }

  async function commitRename() {
    if (!editingGroupId) return;
    const trimmed = editingName.trim();
    const original = groups.find(g => g.id === editingGroupId)?.name ?? '';
    setEditingGroupId(null);
    if (!trimmed || trimmed === original) return;
    // Optimistic update
    onGroupRenamed(editingGroupId, trimmed);
    const { error } = await updateGroupName(editingGroupId, trimmed);
    if (error) onGroupRenamed(editingGroupId, original); // revert
  }

  function cancelRename() {
    setEditingGroupId(null);
  }

  async function handleRoleChange(member: GroupMemberInfo, newRole: Role) {
    if (!activeGroupId) return;
    setRoleError(null);
    setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, role: newRole } : m));
    const { error } = await updateMemberRole(activeGroupId, member.userId, newRole);
    if (error) {
      setRoleError(error);
      setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, role: member.role } : m));
    }
  }

  async function handleRemoveConfirmed() {
    if (!activeGroupId || !pendingRemove) return;
    const member = pendingRemove;
    setPendingRemove(null);
    setRoleError(null);
    setMembers(prev => prev.filter(m => m.userId !== member.userId));
    const { error } = await removeMember(activeGroupId, member.userId);
    if (error) {
      setRoleError(error);
      setMembers(prev => [...prev, member]);
    }
  }

  async function handleConfirmAction() {
    if (!activeGroupId || !confirmAction) return;
    setConfirmLoading(true);
    setConfirmError(null);

    if (confirmAction === 'leave') {
      const { error } = await leaveGroup(activeGroupId);
      if (error) {
        setConfirmError(error);
        setConfirmLoading(false);
        return;
      }
      setConfirmAction(null);
      setConfirmLoading(false);
      onGroupLeft(activeGroupId);
    } else {
      const { error } = await deleteGroupPermanently(activeGroupId);
      if (error) {
        setConfirmError(error);
        setConfirmLoading(false);
        return;
      }
      setConfirmAction(null);
      setConfirmLoading(false);
      onGroupDeleted(activeGroupId);
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 flex flex-col',
          'bg-white dark:bg-slate-900',
          'border-r border-gray-100 dark:border-slate-800',
          'transform transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── Mobile close button (top-right, only on small screens) ── */}
        <div className="flex lg:hidden items-center justify-end px-3 pt-3">
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto pt-2 lg:pt-3">

          {/* ── My Groups collapsible ── */}
          <div className="p-2">
            {/* Trigger row — matches "Manage members" style exactly */}
            <button
              type="button"
              onClick={() => setGroupsOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Users size={14} className="shrink-0" />
              <span className="flex-1 text-left font-medium">My Groups</span>
              {/* Active group name as a subtle preview when collapsed */}
              {!groupsOpen && activeGroup && (
                <span className="truncate max-w-[80px] text-[11px] text-violet-500 dark:text-violet-400 font-medium">
                  {activeGroup.name}
                </span>
              )}
              <ChevronDown
                size={14}
                className={cn('shrink-0 transition-transform duration-200', groupsOpen && 'rotate-180')}
              />
            </button>

            {/* Collapsible group list */}
            {groupsOpen && (
              <div className="mt-1 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 overflow-hidden">
                {groups.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-3">No groups yet.</p>
                ) : (
                  <nav className="divide-y divide-gray-100 dark:divide-slate-700/60">
                    {groups.map(group => {
                      const isAdminOfGroup = group.role === 'admin';
                      const isEditing      = editingGroupId === group.id;

                      // ── Editing state: inline rename input ──
                      if (isEditing) {
                        return (
                          <div
                            key={group.id}
                            className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 dark:bg-violet-900/30"
                          >
                            <input
                              ref={renameInputRef}
                              value={editingName}
                              onChange={e => setEditingName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  { e.preventDefault(); commitRename(); }
                                if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                              }}
                              onBlur={commitRename}
                              maxLength={50}
                              className={cn(
                                'flex-1 min-w-0 bg-transparent text-sm font-medium',
                                'text-violet-700 dark:text-violet-300',
                                'border-b border-violet-300 dark:border-violet-600',
                                'outline-none focus:border-violet-500 dark:focus:border-violet-400',
                              )}
                            />
                            <span className="shrink-0 text-[10px] text-violet-400 dark:text-violet-500 select-none">↵</span>
                          </div>
                        );
                      }

                      // ── Normal row ──
                      return (
                        <button
                          key={group.id}
                          onClick={() => handleSelect(group.id)}
                          onDoubleClick={isAdminOfGroup ? () => startRename(group) : undefined}
                          title={isAdminOfGroup ? 'Double-click to rename' : undefined}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                            group.id === activeGroupId && currentPage === 'app'
                              ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                              : 'text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/60',
                          )}
                        >
                          <span className="flex-1 truncate">{group.name}</span>
                          <span className={cn(
                            'shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
                            ROLE_BADGE_CLASS[group.role as Role] ?? ROLE_BADGE_CLASS.viewer,
                          )}>
                            {group.role.charAt(0).toUpperCase() + group.role.slice(1)}
                          </span>
                          {group.id === activeGroupId && currentPage === 'app' && (
                            <ChevronRight size={13} className="shrink-0 text-violet-400 dark:text-violet-500" />
                          )}
                        </button>
                      );
                    })}
                  </nav>
                )}
              </div>
            )}
          </div>

          {/* ── Active group's invite code ── */}
          {activeGroup && (
            <div className="mx-3 mt-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1.5">
                Invite code
              </p>
              <div className="flex items-center gap-2">
                <span className="flex-1 font-mono text-base font-bold tracking-[0.2em] text-gray-900 dark:text-slate-100">
                  {activeGroup.joinCode}
                </span>
                <button
                  onClick={() => copyCode(activeGroup.joinCode)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Copy invite code"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                Share this code so others can join.
              </p>
            </div>
          )}

          {/* ── Members panel (admin only) ── */}
          {activeGroup && isAdmin && (
            <div className="mx-3 mt-3">
              <button
                onClick={() => setMembersOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Users size={14} className="shrink-0" />
                <span className="flex-1 text-left font-medium">Manage members</span>
                <ChevronDown
                  size={14}
                  className={cn('shrink-0 transition-transform', membersOpen && 'rotate-180')}
                />
              </button>

              {membersOpen && (
                <div className="mt-1 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 overflow-visible">
                  {membersLoading ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-3">Loading…</p>
                  ) : members.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-3">No members found.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                      {members.map(member => {
                        const isSelf = member.userId === currentUserId;
                        return (
                          <li key={member.userId} className="flex items-center gap-2 px-3 py-2.5">
                            <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                                {(member.fullName ?? member.userId)[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs font-medium text-gray-700 dark:text-slate-300 truncate">
                                {member.fullName ?? member.userId.slice(0, 8)}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] text-gray-400 dark:text-slate-500">you</span>
                              )}
                            </span>
                            <RoleDropdown
                              value={member.role as Role}
                              disabled={isSelf}
                              onChange={newRole => handleRoleChange(member, newRole)}
                            />
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => setPendingRemove(member)}
                                className="shrink-0 p-1 rounded-md text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                aria-label={`Remove ${member.fullName ?? 'member'}`}
                              >
                                <UserMinus size={13} />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {roleError && (
                    <p className="text-xs text-red-500 px-3 py-2 border-t border-gray-100 dark:border-slate-700">
                      {roleError}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Group Management ── */}
          {activeGroup && (
            <div className="mx-3 mt-3 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-2 px-1">
                Group Management
              </p>
              <div className="flex flex-col gap-1.5">
                {/* Leave Group — ghost button, all roles */}
                <button
                  type="button"
                  onClick={() => { setConfirmError(null); setConfirmAction('leave'); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <LogOut size={14} className="shrink-0" />
                  Leave Group
                </button>

                {/* Delete Group — ghost until hover, admin only */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => { setConfirmError(null); setConfirmAction('delete'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/15 transition-colors group"
                  >
                    <Trash2 size={14} className="shrink-0 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
                    Delete Group
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Divider ── */}
          <div className="mx-3 my-4 border-t border-gray-100 dark:border-slate-800" />

          {/* ── Create / Join ── */}
          <div className="px-3 pb-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
              Add a group
            </p>
            <GroupActions
              onCreated={handleGroupAdded}
              onJoined={handleGroupAdded}
              onUpgrade={() => { onOpenProfile(); onClose(); }}
            />
          </div>

        </div>

        {/* ── Profile footer (always visible at bottom) ── */}
        <div className="shrink-0 border-t border-gray-100 dark:border-slate-800 p-2">
          <button
            type="button"
            onClick={() => { onOpenProfile(); onClose(); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              currentPage === 'profile'
                ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-semibold'
                : 'text-gray-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300',
            )}
          >
            <User size={15} className="shrink-0" />
            Profile
          </button>
        </div>
      </aside>

      {/* ── Remove member modal ── */}
      {pendingRemove && activeGroup && (
        <RemoveConfirmModal
          member={pendingRemove}
          groupName={activeGroup.name}
          onConfirm={handleRemoveConfirmed}
          onCancel={() => setPendingRemove(null)}
        />
      )}

      {/* ── Leave / Delete group modal ── */}
      {confirmAction && activeGroup && (
        <ConfirmModal
          title={confirmAction === 'leave' ? 'Leave group?' : 'Delete group?'}
          message={
            confirmAction === 'leave'
              ? `Are you sure? You will lose access to ${activeGroup.name}'s history and will need a new invite code to rejoin.`
              : `DANGER: This will permanently delete all expenses, splits, members, and activity for everyone in "${activeGroup.name}".\n\nThis cannot be undone.`
          }
          confirmLabel={confirmAction === 'leave' ? 'Leave Group' : 'Delete Forever'}
          variant="danger"
          loading={confirmLoading}
          error={confirmError}
          onConfirm={handleConfirmAction}
          onCancel={() => { setConfirmAction(null); setConfirmError(null); }}
        />
      )}
    </>
  );
}
