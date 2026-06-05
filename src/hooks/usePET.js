import { useState } from 'react'
import useBoardStore from '@/store/useBoardStore'
import { newInitiativeDefaults, validateInitiativeLimit, quarterStats } from '@/domain/initiatives'

/**
 * Hook que encapsula toda a lógica do PETTab.
 * O componente PETTab só chama funções daqui — sem lógica de negócio no JSX.
 */
export function usePET() {
  const store  = useBoardStore()
  const board  = useBoardStore((s) => s.board)

  const petSlot    = board.pets?.find((s) => s.id === board.activePetId) || board.pets?.[0]
  const pet        = petSlot?.pet
  const initiatives = petSlot?.initiatives || []
  const members    = board.members || []
  const shr        = { ...pet?.sizeHrs }

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState(() => newInitiativeDefaults(pet?.quarter || 'Q1'))
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  function openNew() {
    setForm(newInitiativeDefaults(pet?.quarter || 'Q1'))
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(initiative) {
    setForm({
      title: initiative.title,
      size: initiative.size,
      tag: initiative.tag,
      quarter: initiative.quarter,
      status: initiative.status,
      description: initiative.description || '',
      linkedSprintIds: initiative.linkedSprintIds || [],
      isInitiative: initiative.isInitiative !== false,
      prioritized: initiative.prioritized !== false,
    })
    setEditId(initiative.id)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
  }

  // ── Submit com validação ───────────────────────────────────────────────────
  function submit() {
    if (!form.title.trim()) return

    if (form.isInitiative) {
      const error = validateInitiativeLimit(initiatives, form.quarter, editId)
      if (error) { alert(error); return }
    }

    store.upsertInitiative(editId ? { ...form, id: editId } : form)
    setForm(newInitiativeDefaults(pet?.quarter || 'Q1'))
    setEditId(null)
    setShowForm(false)
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const deleteInitiative = (id) => store.deleteInitiative(id)
  const setStatus = (id, status) => store.patchInitiative(id, { status })
  const togglePrioritized = (id) => {
    const init = initiatives.find((i) => i.id === id)
    if (!init) return
    store.patchInitiative(id, { prioritized: init.prioritized === false ? true : false })
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const stats = quarterStats(initiatives, shr)

  return {
    pet, initiatives, members, shr, stats,
    form, setForm, editId, showForm,
    openNew, openEdit, closeForm, submit,
    deleteInitiative, setStatus, togglePrioritized,
  }
}
