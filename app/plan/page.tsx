'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
function SortableRow({ exercise }: { exercise: EditExercise }) {
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
      className="bg-gray-800 rounded-xl px-3 py-2 flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none select-none px-1 text-lg leading-none"
        aria-label="並び替え"
      >
        ⠿
      </button>
      <span className="text-sm font-medium flex-1">{exercise.name}</span>
      <span className="text-xs text-gray-400">{formatExercise(exercise)}</span>
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
    <div className="border border-gray-700 rounded-xl p-3 space-y-2">
      <p className="text-xs text-gray-400">種目を追加</p>
      <input
        type="text"
        placeholder="種目名（例：サイドレイズ）"
        value={form.name}
        onChange={e => onChange({ ...form, name: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
        className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          placeholder="セット"
          value={form.sets}
          onChange={e => onChange({ ...form, sets: e.target.value })}
          className="w-16 bg-gray-800 rounded-lg px-2 py-2 text-sm text-center text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-gray-500 text-xs">×</span>
        <input
          type="number"
          placeholder="rep"
          value={form.reps}
          onChange={e => onChange({ ...form, reps: e.target.value })}
          className="w-16 bg-gray-800 rounded-lg px-2 py-2 text-sm text-center text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-gray-500 text-xs">rep @</span>
        <input
          type="number"
          placeholder="kg"
          value={form.weight}
          onChange={e => onChange({ ...form, weight: e.target.value })}
          className="w-16 bg-gray-800 rounded-lg px-2 py-2 text-sm text-center text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-gray-500 text-xs">kg</span>
        <button
          onClick={onAdd}
          disabled={!form.name.trim()}
          className="ml-auto text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg px-3 py-2 whitespace-nowrap"
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
  const [addForm, setAddForm] = useState<AddFormState>({ name: '', sets: '', reps: '', weight: '' })
  const [saving, setSaving] = useState(false)

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
    setAddForm({ name: '', sets: '', reps: '', weight: '' })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditExercises([])
    setEditNotes('')
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

  async function saveEdit(menuId: string) {
    setSaving(true)
    try {
      // _key を除いて保存
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const exercises: Exercise[] = editExercises.map(({ _key, ...ex }) => ex)
      const notes = editNotes.trim() || null
      const res = await fetch(`/api/next-menu/${menuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises, notes }),
      })
      if (res.ok) {
        setMenus(prev => prev.map(m => m.id === menuId ? { ...m, exercises, notes } : m))
        setEditingId(null)
        setEditExercises([])
        setEditNotes('')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-gray-900">
        <Link href="/" className="text-gray-400 mr-3 text-xl">←</Link>
        <div>
          <h1 className="font-bold text-lg">次回メニュー</h1>
          <p className="text-xs text-gray-500">AIコーチが提案した次回プラン</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {loading ? (
          <p className="text-center text-gray-500 text-sm mt-20">読み込み中...</p>
        ) : error ? (
          <p className="text-center text-red-400 text-sm mt-20">{error}</p>
        ) : menus.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-4xl mb-4">📋</p>
            <p>まだ次回メニューがありません</p>
            <p className="text-sm mt-2">AIコーチで「書き出す」ボタンを押すと保存されます</p>
          </div>
        ) : (
          menus.map((menu, index) => {
            const isEditing = editingId === menu.id
            return (
              <div key={menu.id} className="bg-gray-900 rounded-2xl p-4 space-y-3">
                {/* ヘッダー */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {index === 0 && (
                      <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 shrink-0">最新</span>
                    )}
                    <span className="text-sm font-bold text-blue-300 truncate">
                      📅 {formatDate(menu.planned_date)}
                    </span>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(menu)}
                        className="shrink-0 w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 flex items-center justify-center text-base leading-none"
                        aria-label="種目を追加・並び替え"
                        title="種目を追加・並び替え"
                      >
                        ＋
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 shrink-0 ml-2">
                    保存: {new Date(menu.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {isEditing ? (
                  <>
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
                            <p className="text-xs text-gray-600 text-center py-2">種目なし</p>
                          ) : (
                            editExercises.map(ex => <SortableRow key={ex._key} exercise={ex} />)
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
                      <p className="text-xs text-gray-400">📝 備考（任意）</p>
                      <textarea
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="方針・注意点など（AIコーチとの会話内容を貼っても）"
                        rows={3}
                        className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    {/* 保存 / キャンセル */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={cancelEdit}
                        className="flex-1 text-sm text-gray-400 border border-gray-700 rounded-xl py-2.5 hover:bg-gray-800"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => saveEdit(menu.id)}
                        disabled={saving}
                        className="flex-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl py-2.5 font-medium"
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
                        {menu.exercises.map((ex, i) => (
                          <div key={i} className="bg-gray-800 rounded-xl px-3 py-2 flex justify-between items-center">
                            <span className="text-sm font-medium">{ex.name}</span>
                            <span className="text-xs text-gray-400">{formatExercise(ex)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {stripMarkdown(menu.content)}
                      </p>
                    )}
                    {/* 備考（表示） */}
                    {menu.notes && (
                      <div className="border-t border-gray-800 pt-2 mt-1">
                        <p className="text-xs text-gray-500 mb-1">📝 備考</p>
                        <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">{menu.notes}</p>
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
