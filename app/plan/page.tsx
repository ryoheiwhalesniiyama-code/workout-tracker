'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { groupExerciseRows } from '@/lib/exerciseRows'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Exercise = { name: string; sets: number | null; reps: number | null; weight: number | null }
type EditExercise = Exercise & { _key: string }
type PlannedMenu = {
  id: string
  created_at: string
  planned_date: string | null
  content: string
  exercises: Exercise[] | null
  notes: string | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '日付未設定'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  })
}

function formatExercise(ex: Exercise): string {
  if (ex.sets != null && ex.reps != null) {
    return `${ex.sets}×${ex.reps}rep${ex.weight != null ? ` @ ${ex.weight}kg` : ''}`
  }
  return '詳細未設定'
}

/** マークダウン記号を除去してプレーンテキスト化する */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '・')
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

let _keyCounter = 0
function makeKey(): string { return `k${++_keyCounter}` }

function toEditExercises(exercises: Exercise[] | null): EditExercise[] {
  return (exercises ?? []).map(ex => ({ ...ex, _key: makeKey() }))
}

// ドラッグ可能な種目行（編集モード用）
function SortableRow({ exercise, onDelete }: { exercise: EditExercise; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise._key,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-field rounded-xl px-3 py-2 flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-stone-600 hover:text-stone-800 cursor-grab active:cursor-grabbing touch-none select-none px-1 text-lg leading-none"
        aria-label="並び替え"
      >
        ⠿
      </button>
      <span className="text-sm font-medium flex-1">{exercise.name}</span>
      <span className="text-xs text-stone-600">{formatExercise(exercise)}</span>
      <button
        onClick={onDelete}
        className="text-stone-700 hover:text-red-800 text-base leading-none px-1 shrink-0"
        aria-label="この種目を削除"
      >
        ×
      </button>
    </div>
  )
}

type AddFormState = { name: string; sets: string; reps: string; weight: string }

function AddExerciseForm({
  form,
  onChange,
  onAdd,
}: {
  form: AddFormState
  onChange: (f: AddFormState) => void
  onAdd: () => void
}) {
  return (
    <div className="border border-stone-400 rounded-xl p-3 space-y-2">
      <p className="text-xs text-stone-600">種目を追加</p>
      <input
        type="text"
        placeholder="種目名（例：サイドレイズ）"
        value={form.name}
        onChange={e => onChange({ ...form, name: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
        className="w-full bg-field rounded-lg px-3 py-2 text-sm text-foreground placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-accent-hover"
      />
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          placeholder="セット"
          value={form.sets}
          onChange={e => onChange({ ...form, sets: e.target.value })}
          className="w-16 bg-field rounded-lg px-2 py-2 text-sm text-center text-foreground placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-accent-hover"
        />
        <span className="text-stone-600 text-xs">×</span>
        <input
          type="number"
          placeholder="rep"
          value={form.reps}
          onChange={e => onChange({ ...form, reps: e.target.value })}
          className="w-16 bg-field rounded-lg px-2 py-2 text-sm text-center text-foreground placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-accent-hover"
        />
        <span className="text-stone-600 text-xs">rep @</span>
        <input
          type="number"
          placeholder="kg"
          value={form.weight}
          onChange={e => onChange({ ...form, weight: e.target.value })}
          className="w-16 bg-field rounded-lg px-2 py-2 text-sm text-center text-foreground placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-accent-hover"
        />
        <span className="text-stone-600 text-xs">kg</span>
        <button
          onClick={onAdd}
          disabled={!form.name.trim()}
          className="ml-auto text-xs bg-stone-200 hover:bg-stone-300 disabled:opacity-40 text-foreground rounded-lg px-3 py-2 whitespace-nowrap"
        >
          追加
        </button>
      </div>
    </div>
  )
}

export default function PlanPage() {
  const [menus, setMenus] = useState<PlannedMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editExercises, setEditExercises] = useState<EditExercise[]>([])
  const [editNotes, setEditNotes] = useState<string>('')
  const [editDate, setEditDate] = useState<string>('')
  const [addForm, setAddForm] = useState<AddFormState>({ name: '', sets: '', reps: '', weight: '' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    fetch('/api/next-menu')
      .then(r => r.json())
      .then(data => {
        setMenus(data.menus ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('読み込みに失敗しました')
        setLoading(false)
      })
  }, [])

  function startEdit(menu: PlannedMenu) {
    setEditingId(menu.id)
    setEditExercises(toEditExercises(menu.exercises))
    setEditNotes(menu.notes ?? '')
    setEditDate(menu.planned_date ?? '')
    setAddForm({ name: '', sets: '', reps: '', weight: '' })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditExercises([])
    setEditNotes('')
    setEditDate('')
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setEditExercises(items => {
        const oldIndex = items.findIndex(ex => ex._key === active.id)
        const newIndex = items.findIndex(ex => ex._key === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  function addExercise() {
    if (!addForm.name.trim()) return
    const newEx: EditExercise = {
      name: addForm.name.trim(),
      sets: addForm.sets !== '' ? parseInt(addForm.sets) : null,
      reps: addForm.reps !== '' ? parseInt(addForm.reps) : null,
      weight: addForm.weight !== '' ? parseFloat(addForm.weight) : null,
      _key: makeKey(),
    }
    setEditExercises(prev => [...prev, newEx])
    setAddForm({ name: '', sets: '', reps: '', weight: '' })
  }

  async function deleteMenu(menuId: string) {
    if (!window.confirm('このメニューを削除しますか？')) return
    setDeletingId(menuId)
    try {
      const res = await fetch(`/api/next-menu/${menuId}`, { method: 'DELETE' })
      if (res.ok) {
        setMenus(prev => prev.filter(m => m.id !== menuId))
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function saveEdit(menuId: string) {
    setSaving(true)
    try {
      // _key を除いて保存
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const exercises: Exercise[] = editExercises.map(({ _key, ...ex }) => ex)
      const notes = editNotes.trim() || null
      const planned_date = editDate || null
      const res = await fetch(`/api/next-menu/${menuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises, notes, planned_date }),
      })
      if (res.ok) {
        setMenus(prev => prev.map(m =>
          m.id === menuId ? { ...m, exercises, notes, planned_date } : m
        ))
        setEditingId(null)
        setEditExercises([])
        setEditNotes('')
        setEditDate('')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center px-4 py-3 border-b border-stone-200 bg-surface">
        <Link href="/" className="text-stone-600 mr-3 text-xl">←</Link>
        <div>
          <h1 className="font-bold text-lg">次回メニュー</h1>
          <p className="text-xs text-stone-600">AIコーチが提案した次回プラン</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {loading ? (
          <p className="text-center text-stone-600 text-sm mt-20">読み込み中...</p>
        ) : error ? (
          <p className="text-center text-red-800 text-sm mt-20">{error}</p>
        ) : menus.length === 0 ? (
          <div className="text-center text-stone-600 mt-20">
            <p className="text-4xl mb-4">📋</p>
            <p>まだ次回メニューがありません</p>
            <p className="text-sm mt-2">AIコーチで「書き出す」ボタンを押すと保存されます</p>
          </div>
        ) : (
          menus.map((menu, index) => {
            const isEditing = editingId === menu.id
            return (
              <div key={menu.id} className="bg-surface rounded-2xl p-4 space-y-3">
                {/* ヘッダー */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {index === 0 && (
                      <span className="text-xs bg-accent text-white rounded-full px-2 py-0.5 shrink-0">最新</span>
                    )}
                    <span className="text-sm font-bold text-accent truncate">
                      📅 {formatDate(menu.planned_date)}
                    </span>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(menu)}
                        className="shrink-0 w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-base leading-none"
                        aria-label="種目を追加・並び替え"
                        title="種目を追加・並び替え"
                      >
                        ＋
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-stone-700">
                      保存: {new Date(menu.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    </span>
                    {!isEditing && (
                      <button
                        onClick={() => deleteMenu(menu.id)}
                        disabled={deletingId === menu.id}
                        className="text-stone-700 hover:text-red-800 disabled:opacity-40 text-xs px-1"
                        aria-label="削除"
                        title="メニューを削除"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <>
                    {/* 日付（編集） */}
                    <div className="space-y-1">
                      <p className="text-xs text-stone-600">📅 実施予定日</p>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        style={{ colorScheme: 'light' }}
                        className="w-full bg-field rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-hover"
                      />
                    </div>

                    {/* ドラッグ&ドロップリスト */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={editExercises.map(ex => ex._key)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {editExercises.length === 0 ? (
                            <p className="text-xs text-stone-700 text-center py-2">種目なし</p>
                          ) : (
                            editExercises.map(ex => (
                              <SortableRow
                                key={ex._key}
                                exercise={ex}
                                onDelete={() => setEditExercises(prev => prev.filter(e => e._key !== ex._key))}
                              />
                            ))
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>

                    {/* 追加フォーム */}
                    <AddExerciseForm
                      form={addForm}
                      onChange={setAddForm}
                      onAdd={addExercise}
                    />

                    {/* 備考（編集） */}
                    <div className="space-y-1">
                      <p className="text-xs text-stone-600">📝 備考（任意）</p>
                      <textarea
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="方針・注意点など（AIコーチとの会話内容を貼っても）"
                        rows={3}
                        className="w-full bg-field rounded-lg px-3 py-2 text-sm text-foreground placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-accent-hover resize-none"
                      />
                    </div>

                    {/* 保存 / キャンセル */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={cancelEdit}
                        className="flex-1 text-sm text-stone-600 border border-stone-400 rounded-xl py-2.5 hover:bg-field"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => saveEdit(menu.id)}
                        disabled={saving}
                        className="flex-1 text-sm bg-accent hover:bg-accent-hover disabled:opacity-60 text-white rounded-xl py-2.5 font-medium"
                      >
                        {saving ? '保存中...' : '保存する ✅'}
                      </button>
                    </div>
                  </>
                ) : (
                  // 通常表示
                  <>
                    {menu.exercises && menu.exercises.length > 0 ? (
                      <div className="space-y-2">
                        {groupExerciseRows(menu.exercises).map((ex, i) => (
                          <div key={i} className="bg-field rounded-xl px-3 py-2 flex justify-between items-center">
                            <span className="text-sm font-medium">{ex.name}</span>
                            <span className="text-xs text-stone-600">{formatExercise(ex)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">
                        {stripMarkdown(menu.content)}
                      </p>
                    )}
                    {/* 備考（表示） */}
                    {menu.notes && (
                      <div className="border-t border-stone-200 pt-2 mt-1">
                        <p className="text-xs text-stone-600 mb-1">📝 備考</p>
                        <p className="text-xs text-stone-600 whitespace-pre-wrap leading-relaxed">{menu.notes}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
