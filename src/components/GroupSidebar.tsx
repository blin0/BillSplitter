import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Reorder } from 'framer-motion';
import { Check, Copy, ChevronRight, X, Users, ChevronDown, UserMinus, AlertTriangle, LogOut, Trash2, User, Plus, Hash, Loader2, Sparkles, Lock, BarChart3, Percent, MessageSquare, Upload, ImagePlus, GripVertical, LayoutDashboard } from 'lucide-react';
import { GroupIconDisplay, GROUP_ICON_DEFS } from '../lib/groupIcons';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import type { GroupInfo, GroupMemberInfo } from '../lib/db';
import { fetchGroupMembers, updateMemberRole, removeMember, updateGroupName, updateGroupTaxRate, leaveGroup, deleteGroupPermanently, fetchOwnGroupCount, fetchGroupMemberCount, createGroup, joinGroupByCode, insertParticipant, updateGroupIcon } from '../lib/db';
import { useCurrency } from '../context/CurrencyContext';
import { useSubscriptionContext } from '../context/SubscriptionContext';
import { groupLimit, memberLimit, nextTierName } from '../lib/hasAccess';
import ConfirmModal from './ui/ConfirmModal';

interface Props {
  groups:              GroupInfo[];
  activeGroupId:       string | null;
  currentUserId:       string | null;
  currentUserName:     string | null;
  onSelect:            (id: string) => void;
  isOpen:              boolean;
  onClose:             () => void;
  onGroupAdded:        (group: GroupInfo) => void;
  onGroupRenamed:      (groupId: string, newName: string) => void;
  /** Called after successfully leaving a group */
  onGroupLeft:         (groupId: string) => void;
  /** Called after successfully deleting a group */
  onGroupDeleted:      (groupId: string) => void;
  /** Navigate to the Profile page */
  onOpenProfile:       () => void;
  /** Navigate to the Dashboard page */
  onOpenDashboard?:    () => void;
  /** Navigate to the Analytics page */
  onOpenAnalytics:     () => void;
  /** Navigate to the Feedback dashboard (dev tier only) */
  onOpenFeedback?:     () => void;
  /** Called after admin saves a new group default tax rate */
  onGroupTaxRateChanged: (groupId: string, rate: number | null) => void;
  /** Called after the group icon is changed */
  onGroupIconChanged?: (groupId: string, icon: string | null) => void;
}

// ─── Role metadata ────────────────────────────────────────────────────────────

type Role = 'admin' | 'editor' | 'viewer';

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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const ROLES: { value: Role; label: string; description: string }[] = [
    { value: 'admin',  label: t('sidebar.roleAdmin'),  description: t('sidebar.roleAdminDesc')  },
    { value: 'editor', label: t('sidebar.roleEditor'), description: t('sidebar.roleEditorDesc') },
    { value: 'viewer', label: t('sidebar.roleViewer'), description: t('sidebar.roleViewerDesc') },
  ];

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const meta = ROLES.find(r => r.value === value) ?? ROLES[2];

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

// ─── Remove member confirmation ───────────────────────────────────────────────

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
  const { t } = useTranslation();
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
          {t('sidebar.removeMember')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
          <span className="font-medium text-gray-700 dark:text-slate-300">{displayName}</span>
          {' '}{t('sidebar.removeMemberWill')}{' '}
          <span className="font-medium text-gray-700 dark:text-slate-300">{groupName}</span>
          {t('sidebar.removeMemberSuffix')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-500 active:bg-red-700 transition-colors"
          >
            {t('common.remove')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GroupSidebar ─────────────────────────────────────────────────────────────

type ConfirmAction = 'leave' | 'delete';

function applyStoredOrder(groups: GroupInfo[], userId: string | null): GroupInfo[] {
  if (!userId || groups.length === 0) return groups;
  try {
    const saved = localStorage.getItem(`billsplitter_group_order_${userId}`);
    if (!saved) return groups;
    const ids: string[] = JSON.parse(saved);
    const byId = new Map(groups.map(g => [g.id, g]));
    const ordered = ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
    const remaining = groups.filter(g => !ids.includes(g.id));
    return [...ordered, ...remaining];
  } catch {
    return groups;
  }
}

function resizeImageToDataUrl(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function GroupSidebar({
  groups,
  activeGroupId,
  currentUserId,
  currentUserName,
  onSelect,
  isOpen,
  onClose,
  onGroupAdded,
  onGroupRenamed,
  onGroupLeft,
  onGroupDeleted,
  onOpenProfile,
  onOpenDashboard,
  onOpenAnalytics,
  onOpenFeedback,
  onGroupTaxRateChanged,
  onGroupIconChanged,
}: Props) {
  const { t } = useTranslation();
  const location       = useLocation();
  const isDashboardPage = location.pathname === '/dashboard';
  const isProfilePage   = location.pathname === '/profile';
  const isAnalyticsPage = location.pathname.startsWith('/analytics');
  const isFeedbackPage  = location.pathname === '/feedback';
  const { currency }   = useCurrency();
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
  const renameInputRef   = useRef<HTMLInputElement>(null);
  const iconPickerRef    = useRef<HTMLDivElement>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const [iconPickerGroupId, setIconPickerGroupId] = useState<string | null>(null);
  const [iconPickerSaving,  setIconPickerSaving ] = useState(false);

  // Ordered group list — initialized from groups prop + localStorage
  const [orderedGroups, setOrderedGroups] = useState<GroupInfo[]>(() =>
    applyStoredOrder(groups, currentUserId)
  );

  // When groups prop changes (icon/name update, add, remove), keep custom order but sync data
  useEffect(() => {
    setOrderedGroups(prev => {
      if (prev.length === 0 && groups.length > 0) {
        return applyStoredOrder(groups, currentUserId);
      }
      const byId = new Map(groups.map(g => [g.id, g]));
      const validPrev = prev.filter(p => byId.has(p.id)).map(p => byId.get(p.id)!);
      const newGroups  = groups.filter(g => !prev.some(p => p.id === g.id));
      return [...validPrev, ...newGroups];
    });
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user changes, reload stored order for the new user
  useEffect(() => {
    setOrderedGroups(applyStoredOrder(groups, currentUserId));
  }, [currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReorder(newOrder: GroupInfo[]) {
    setOrderedGroups(newOrder);
    if (!currentUserId) return;
    try {
      localStorage.setItem(
        `billsplitter_group_order_${currentUserId}`,
        JSON.stringify(newOrder.map(g => g.id)),
      );
    } catch (_) {}
  }

  // ── Group tax rate state ──────────────────────────────────────────────────
  const [taxOpen,       setTaxOpen      ] = useState(false);
  const [groupTaxInput, setGroupTaxInput] = useState('');
  const [taxSaving,     setTaxSaving    ] = useState(false);
  const [taxSaveError,  setTaxSaveError ] = useState<string | null>(null);
  const [taxSaved,      setTaxSaved     ] = useState(false);

  // ── Add / Join group state ────────────────────────────────────────────────
  const [addJoinOpen,   setAddJoinOpen  ] = useState(false);
  const [createName,    setCreateName   ] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError,   setCreateError  ] = useState<string | null>(null);
  const [blocked,       setBlocked      ] = useState(false);
  const [joinCode,      setJoinCode     ] = useState('');
  const [joinLoading,   setJoinLoading  ] = useState(false);
  const [joinError,     setJoinError    ] = useState<string | null>(null);

  const subscription = useSubscriptionContext();

  // ── Member count for invite-code gate ──────────────────────────────────────
  const [memberCount, setMemberCount] = useState(0);
  useEffect(() => {
    if (!activeGroupId) return;
    fetchGroupMemberCount(activeGroupId).then(({ data }) => {
      if (data != null) setMemberCount(data);
    });
  }, [activeGroupId]);

  // Seed tax input when active group changes
  useEffect(() => {
    const rate = groups.find(g => g.id === activeGroupId)?.defaultTaxRate;
    setGroupTaxInput(rate != null && rate > 0 ? String(rate) : '');
    setTaxSaveError(null);
    setTaxSaved(false);
  }, [activeGroupId, groups]);

  const activeGroup  = groups.find(g => g.id === activeGroupId);
  const isAdmin      = activeGroup?.role === 'admin';

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
    setIconPickerGroupId(null);
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
    onGroupRenamed(editingGroupId, trimmed);
    const { error } = await updateGroupName(editingGroupId, trimmed);
    if (error) onGroupRenamed(editingGroupId, original);
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreateError(null);
    setBlocked(false);
    setCreateLoading(true);
    const limit = groupLimit(subscription.subscriptionTier);
    if (limit !== null) {
      const { data: count } = await fetchOwnGroupCount();
      if ((count ?? 0) >= limit) {
        setCreateLoading(false);
        setBlocked(true);
        return;
      }
    }
    const { data, error } = await createGroup(name);
    setCreateLoading(false);
    if (error || !data) {
      setCreateError(error ?? t('common.error'));
    } else {
      setCreateName('');
      // Auto-add creator as a linked named participant
      if (currentUserName && currentUserId) {
        void insertParticipant(data.id, currentUserName, currentUserId);
      }
      handleGroupAdded(data);
      setAddJoinOpen(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setJoinError(t('sidebar.errorCodeLength')); return; }
    setJoinError(null);
    setJoinLoading(true);
    const { data, error } = await joinGroupByCode(code);
    setJoinLoading(false);
    if (error || !data) {
      setJoinError(error ?? t('common.error'));
    } else {
      setJoinCode('');
      // Auto-add joiner as a linked named participant
      if (currentUserName && currentUserId) {
        void insertParticipant(data.id, currentUserName, currentUserId);
      }
      handleGroupAdded(data);
      setAddJoinOpen(false);
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

  async function handleSaveTaxRate() {
    if (!activeGroupId) return;
    const parsed = parseFloat(groupTaxInput);
    const rate   = isFinite(parsed) && parsed > 0 ? Math.min(100, parsed) : null;
    setTaxSaving(true);
    setTaxSaveError(null);
    const { error } = await updateGroupTaxRate(activeGroupId, rate);
    setTaxSaving(false);
    if (error) { setTaxSaveError(error); return; }
    setTaxSaved(true);
    setTimeout(() => setTaxSaved(false), 2000);
    onGroupTaxRateChanged(activeGroupId, rate);
  }

  function roleLabel(role: string): string {
    if (role === 'admin')  return t('sidebar.roleAdmin');
    if (role === 'editor') return t('sidebar.roleEditor');
    return t('sidebar.roleViewer');
  }

  // Close icon picker when clicking outside it
  useEffect(() => {
    if (!iconPickerGroupId) return;
    function handle(e: MouseEvent) {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setIconPickerGroupId(null);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [iconPickerGroupId]);

  async function handlePickIcon(groupId: string, icon: string | null) {
    setIconPickerSaving(true);
    const { error } = await updateGroupIcon(groupId, icon);
    setIconPickerSaving(false);
    if (!error) {
      onGroupIconChanged?.(groupId, icon);
      setIconPickerGroupId(null);
    }
  }

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !iconPickerGroupId) return;
    e.target.value = '';
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      await handlePickIcon(iconPickerGroupId, dataUrl);
    } catch { /* ignore upload errors */ }
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
          'bg-[#F2F1EC] dark:bg-slate-900',
          'border-r border-[#EAE9E4] dark:border-slate-800',
          'transform transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── Mobile close button (top-right, only on small screens) ── */}
        <div className="flex lg:hidden items-center justify-end px-3 pt-3">
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto pt-2 lg:pt-3">

          {/* ── My Groups collapsible ── */}
          <div className="p-2">
            <button
              type="button"
              onClick={() => setGroupsOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-[#E8E6E0] dark:hover:bg-slate-800 transition-colors"
            >
              <Users size={14} className="shrink-0" />
              <span className="flex-1 text-left font-medium">{t('sidebar.myGroups')}</span>
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

            {groupsOpen && (
              <div className="mt-1 rounded-xl bg-[#EAE9E4] dark:bg-slate-800 border border-[#D8D6D0] dark:border-slate-700 overflow-hidden">
                {groups.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-3">{t('sidebar.noGroups')}</p>
                ) : (
                  <Reorder.Group
                    as="nav"
                    axis="y"
                    values={orderedGroups}
                    onReorder={handleReorder}
                    className="divide-y divide-gray-100 dark:divide-slate-700/60"
                  >
                    {orderedGroups.map(group => {
                      const isAdminOfGroup = group.role === 'admin';
                      const isEditing      = editingGroupId === group.id;
                      const isActive       = group.id === activeGroupId && !isProfilePage;
                      const iconClass      = isActive ? 'text-violet-500 dark:text-violet-400' : 'text-gray-400 dark:text-slate-500';
                      const showHandle     = orderedGroups.length > 1;

                      return (
                        <Reorder.Item
                          key={group.id}
                          value={group}
                          as="div"
                          onDragStart={() => setIconPickerGroupId(null)}
                          className="flex items-stretch bg-gray-50 dark:bg-slate-800 select-none"
                          style={{ listStyle: 'none' }}
                        >
                          {/* Drag handle — only shown when 2+ groups */}
                          {showHandle && !isEditing && (
                            <div className="flex items-center px-1 touch-none cursor-grab active:cursor-grabbing text-gray-300 dark:text-slate-600 hover:text-gray-400 dark:hover:text-slate-500 transition-colors shrink-0 self-stretch">
                              <GripVertical size={12} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 dark:bg-violet-900/30">
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
                            ) : (
                              <button
                                onClick={() => handleSelect(group.id)}
                                onDoubleClick={isAdminOfGroup ? () => startRename(group) : undefined}
                                title={isAdminOfGroup ? 'Double-click to rename' : undefined}
                                className={cn(
                                  'w-full flex items-center gap-2 py-2.5 text-left text-sm transition-colors',
                                  showHandle ? 'pl-1 pr-3' : 'px-3',
                                  isActive
                                    ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                                    : 'text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/60',
                                )}
                              >
                                {/* Icon zone — clickable for admins to change */}
                                {isAdminOfGroup ? (
                                  <span
                                    onClick={e => {
                                      e.stopPropagation();
                                      setIconPickerGroupId(prev => prev === group.id ? null : group.id);
                                    }}
                                    className="relative flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0 group/icontrigger"
                                    title="Change icon"
                                  >
                                    {group.icon ? (
                                      <GroupIconDisplay icon={group.icon} size={14} className={iconClass} />
                                    ) : (
                                      <ImagePlus size={12} className="text-gray-300 dark:text-slate-600 group-hover/icontrigger:text-gray-500 dark:group-hover/icontrigger:text-slate-400 transition-colors" />
                                    )}
                                  </span>
                                ) : (
                                  <GroupIconDisplay icon={group.icon} size={15} className={iconClass} />
                                )}
                                <span className="flex-1 truncate">{group.name}</span>
                                <span className={cn(
                                  'shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
                                  ROLE_BADGE_CLASS[group.role as Role] ?? ROLE_BADGE_CLASS.viewer,
                                )}>
                                  {roleLabel(group.role)}
                                </span>
                                {isActive && (
                                  <ChevronRight size={13} className="shrink-0 text-violet-400 dark:text-violet-500" />
                                )}
                              </button>
                            )}

                            {/* Inline icon picker panel */}
                            {iconPickerGroupId === group.id && !isEditing && (
                              <div ref={iconPickerRef} className="px-2 pb-2 border-t border-gray-100 dark:border-slate-700/40">
                                <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 p-2.5 mt-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                                      Change Icon
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setIconPickerGroupId(null)}
                                      className="p-0.5 rounded text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-5 gap-1 mb-2">
                                    {GROUP_ICON_DEFS.map(({ name, label, Icon }) => (
                                      <button
                                        key={name}
                                        type="button"
                                        title={label}
                                        disabled={iconPickerSaving}
                                        onClick={() => handlePickIcon(group.id, name)}
                                        className={cn(
                                          'flex items-center justify-center p-1.5 rounded-lg transition-colors disabled:opacity-40',
                                          group.icon === name
                                            ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 ring-1 ring-violet-400/40'
                                            : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400',
                                        )}
                                      >
                                        <Icon size={14} strokeWidth={1.5} />
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      title="Upload image"
                                      disabled={iconPickerSaving}
                                      onClick={() => iconFileInputRef.current?.click()}
                                      className={cn(
                                        'flex items-center justify-center p-1.5 rounded-lg transition-colors disabled:opacity-40',
                                        group.icon?.startsWith('data:')
                                          ? 'bg-violet-100 dark:bg-violet-900/40 ring-1 ring-violet-400/40'
                                          : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400',
                                      )}
                                    >
                                      {group.icon?.startsWith('data:') ? (
                                        <img src={group.icon} alt="custom" className="w-3.5 h-3.5 rounded-full object-cover" />
                                      ) : (
                                        <Upload size={14} strokeWidth={1.5} />
                                      )}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2 h-4">
                                    {iconPickerSaving && (
                                      <Loader2 size={11} className="animate-spin text-violet-500 shrink-0" />
                                    )}
                                    {group.icon && !iconPickerSaving && (
                                      <button
                                        type="button"
                                        onClick={() => handlePickIcon(group.id, null)}
                                        className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                      >
                                        Remove icon
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                )}
              </div>
            )}
          </div>

          {/* ── Active group's invite code ── */}
          {activeGroup && (() => {
            const mLimit = memberLimit(subscription.subscriptionTier);
            const atMemberLimit = mLimit !== null && memberCount >= mLimit;
            return (
              <div className="mx-3 mt-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1.5">
                  {t('groups.inviteCode')}
                </p>
                {atMemberLimit ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Lock size={12} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-600 dark:text-slate-400 leading-snug">
                        Member limit reached ({mLimit}/{mLimit}). Upgrade to add more.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { onOpenProfile(); onClose(); }}
                      className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 text-white text-xs font-semibold rounded-lg py-1.5 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Sparkles size={11} />
                      Upgrade to {nextTierName(subscription.subscriptionTier)}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-mono text-base font-bold tracking-[0.2em] text-gray-900 dark:text-slate-100">
                        {activeGroup.joinCode}
                      </span>
                      <button
                        onClick={() => copyCode(activeGroup.joinCode)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                        aria-label={t('sidebar.copyInviteCode')}
                      >
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                      {t('sidebar.shareCode')}
                      {mLimit !== null && (
                        <span className="ml-1 text-gray-300 dark:text-slate-600">({memberCount}/{mLimit})</span>
                      )}
                    </p>
                  </>
                )}
              </div>
            );
          })()}

          {/* ── Members panel (admin only) ── */}
          {activeGroup && isAdmin && (
            <div className="mx-3 mt-3">
              <button
                onClick={() => setMembersOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-[#E8E6E0] dark:hover:bg-slate-800 transition-colors"
              >
                <Users size={14} className="shrink-0" />
                <span className="flex-1 text-left font-medium">{t('sidebar.manageMembers')}</span>
                <ChevronDown
                  size={14}
                  className={cn('shrink-0 transition-transform', membersOpen && 'rotate-180')}
                />
              </button>

              {membersOpen && (
                <div className="mt-1 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 overflow-visible">
                  {membersLoading ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-3">{t('common.loading')}</p>
                  ) : members.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-3">{t('sidebar.noMembers')}</p>
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
                                <span className="text-[10px] text-gray-400 dark:text-slate-500">{t('sidebar.you')}</span>
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

          {/* ── Group Tax Rate (admin only) ── */}
          {activeGroup && isAdmin && (
            <div className="mx-3 mt-3">
              <button
                type="button"
                onClick={() => setTaxOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-[#E8E6E0] dark:hover:bg-slate-800 transition-colors"
              >
                <Percent size={14} className="shrink-0" />
                <span className="flex-1 text-left font-medium">{t('groups.taxRate')}</span>
                {activeGroup.defaultTaxRate != null && activeGroup.defaultTaxRate > 0 && (
                  <span className="text-[11px] font-semibold text-violet-500 dark:text-violet-400 shrink-0">
                    {activeGroup.defaultTaxRate}%
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={cn('shrink-0 transition-transform', taxOpen && 'rotate-180')}
                />
              </button>

              {taxOpen && (
                <div className="mt-1 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-3 space-y-2.5">
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
                    {t('sidebar.taxRateDesc')}
                  </p>

                  <div className={cn(
                    'flex items-center rounded-xl border transition-colors',
                    'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600',
                    'hover:border-violet-400 dark:hover:border-violet-500',
                    'focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-300/40',
                  )}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={groupTaxInput}
                      onChange={e => { setGroupTaxInput(e.target.value); setTaxSaved(false); setTaxSaveError(null); }}
                      placeholder="0"
                      className="flex-1 bg-transparent outline-none text-xs px-3 py-2 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
                    />
                    <span className="pr-3 text-xs font-medium text-gray-400 dark:text-slate-500 select-none">%</span>
                  </div>

                  {/* CAD quick-fill suggestions */}
                  {currency === 'CAD' && (
                    <div className="flex gap-1.5">
                      {[{ label: '13% HST', value: '13' }, { label: '5% GST', value: '5' }].map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => { setGroupTaxInput(s.value); setTaxSaved(false); setTaxSaveError(null); }}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 hover:brightness-95 dark:hover:brightness-110 transition-all"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {taxSaveError && (
                    <p className="text-[11px] text-red-500 dark:text-red-400">{taxSaveError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveTaxRate}
                    disabled={taxSaving}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white"
                  >
                    {taxSaving ? (
                      <><Loader2 size={11} className="animate-spin" /> {t('sidebar.saving')}</>
                    ) : taxSaved ? (
                      <><Check size={11} /> {t('sidebar.saved')}</>
                    ) : (
                      t('sidebar.saveRate')
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Group Management ── */}
          {activeGroup && (
            <div className="mx-3 mt-3 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-2 px-1">
                {t('sidebar.groupManagement')}
              </p>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => { setConfirmError(null); setConfirmAction('leave'); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <LogOut size={14} className="shrink-0" />
                  {t('groups.leave')}
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => { setConfirmError(null); setConfirmAction('delete'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/15 transition-colors group"
                  >
                    <Trash2 size={14} className="shrink-0 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
                    {t('groups.delete')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Divider ── */}
          <div className="mx-3 my-2 border-t border-gray-100 dark:border-slate-800" />

          {/* ── Add / Join Group collapsible ── */}
          <div className="p-2 pb-4">
            <button
              type="button"
              onClick={() => setAddJoinOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-[#E8E6E0] dark:hover:bg-slate-800 transition-colors"
            >
              <Plus size={14} className="shrink-0" />
              <span className="flex-1 text-left font-medium">{t('sidebar.addJoinGroup')}</span>
              <ChevronDown
                size={14}
                className={cn('shrink-0 transition-transform duration-300', addJoinOpen && 'rotate-180')}
              />
            </button>

            <div className={cn(
              'overflow-hidden transition-all duration-300',
              addJoinOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0',
            )}>
              <div className="rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                {blocked ? (
                  <div className="p-3 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <Lock size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{t('sidebar.freePlanLimit')}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {t('sidebar.upgradeProDesc')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setBlocked(false); onOpenProfile(); onClose(); }}
                      className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 text-white text-xs font-semibold rounded-lg py-1.5 transition-all"
                    >
                      <Sparkles size={12} /> {t('sidebar.upgradeProBtn')}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* ── Create New ── */}
                    <form onSubmit={handleCreate} className="p-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">{t('sidebar.createNew')}</p>
                      <input
                        type="text"
                        name="group-name"
                        required
                        placeholder={t('sidebar.groupNamePlaceholder')}
                        value={createName}
                        onChange={e => setCreateName(e.target.value)}
                        maxLength={60}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 transition-colors hover:border-violet-400 dark:hover:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                      {createError && <p className="text-[11px] text-red-500 dark:text-red-400">{createError}</p>}
                      <button
                        type="submit"
                        disabled={createLoading || !createName.trim()}
                        className="w-full flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg py-1.5 transition-colors"
                      >
                        {createLoading
                          ? <><Loader2 size={12} className="animate-spin" /> {t('sidebar.creating')}</>
                          : t('groups.createGroup')}
                      </button>
                    </form>

                    <div className="mx-3 border-t border-gray-200 dark:border-slate-700" />

                    {/* ── Join Existing ── */}
                    <form onSubmit={handleJoin} className="p-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">{t('sidebar.joinExisting')}</p>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 transition-colors hover:border-violet-400 dark:hover:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent">
                        <Hash size={12} className="text-gray-400 dark:text-slate-500 shrink-0" />
                        <input
                          type="text"
                          name="invite-code"
                          placeholder={t('sidebar.codePlaceholder')}
                          value={joinCode}
                          onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                          maxLength={6}
                          className="flex-1 bg-transparent text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none font-mono tracking-widest uppercase"
                        />
                      </div>
                      {joinError && <p className="text-[11px] text-red-500 dark:text-red-400">{joinError}</p>}
                      <button
                        type="submit"
                        disabled={joinLoading || joinCode.trim().length !== 6}
                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg py-1.5 transition-colors"
                      >
                        {joinLoading
                          ? <><Loader2 size={12} className="animate-spin" /> {t('sidebar.joining')}</>
                          : t('groups.joinGroup')}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Hidden file input for icon upload */}
        <input
          ref={iconFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleIconUpload}
        />

        {/* ── Footer (Dashboard + Analytics + Profile) ── */}
        <div className="shrink-0 border-t border-gray-100 dark:border-slate-800 p-2 space-y-0.5">
          {onOpenDashboard && (
            <button
              type="button"
              onClick={() => { onOpenDashboard(); onClose(); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isDashboardPage
                  ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-semibold'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300',
              )}
            >
              <LayoutDashboard size={15} className="shrink-0" />
              Dashboard
            </button>
          )}
          <button
            type="button"
            onClick={() => { onOpenAnalytics(); onClose(); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              isAnalyticsPage
                ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-semibold'
                : 'text-gray-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300',
            )}
          >
            <BarChart3 size={15} className="shrink-0" />
            {t('nav.analytics')}
          </button>
          <button
            type="button"
            onClick={() => { onOpenProfile(); onClose(); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              isProfilePage
                ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-semibold'
                : 'text-gray-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300',
            )}
          >
            <User size={15} className="shrink-0" />
            {t('profile.title')}
          </button>

          {subscription.actualTier === 3 && onOpenFeedback && (
            <button
              type="button"
              onClick={() => { onOpenFeedback(); onClose(); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isFeedbackPage
                  ? 'bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-300 font-semibold'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 hover:text-fuchsia-700 dark:hover:text-fuchsia-300',
              )}
            >
              <MessageSquare size={15} className="shrink-0" />
              Feedback
              <span className="ml-auto px-1.5 py-px rounded-full text-[9px] font-bold bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white">
                DEV
              </span>
            </button>
          )}
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
          title={confirmAction === 'leave' ? t('sidebar.leaveGroupTitle') : t('sidebar.deleteGroupTitle')}
          message={
            confirmAction === 'leave'
              ? t('sidebar.leaveGroupMsg', { name: activeGroup.name })
              : t('sidebar.deleteGroupMsg', { name: activeGroup.name })
          }
          confirmLabel={confirmAction === 'leave' ? t('sidebar.leaveForever') : t('sidebar.deleteForever')}
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
