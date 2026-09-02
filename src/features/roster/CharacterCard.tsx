import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { classes, races, subraces } from '../../data/registry.ts'
import { totalLevel, type Character } from '../../rules/character.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import { buildExport, downloadJson, safeFileName } from '../../state/transfer.ts'

/**
 * Karakter listesindeki tek kart.
 *
 * Yeniden adlandırma yerinde yapılır (ayrı bir ekran ya da `prompt()` yerine):
 * isme tıklanınca alan düzenlenebilir hâle gelir, Enter kaydeder, Escape iptal
 * eder.
 */
export default function CharacterCard({ character }: { character: Character }) {
  const renameCharacter = useCharacterStore((s) => s.renameCharacter)
  const duplicateCharacter = useCharacterStore((s) => s.duplicateCharacter)
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter)

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(character.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== character.name) renameCharacter(character.id, trimmed)
    else setDraftName(character.name)
    setEditing(false)
  }

  const cancel = () => {
    setDraftName(character.name)
    setEditing(false)
  }

  const race = character.raceId ? races.get(character.raceId) : undefined
  const subrace = character.subraceId ? subraces.get(character.subraceId) : undefined
  const cls = character.classes[0] ? classes.get(character.classes[0].classId) : undefined

  const buttonClass =
    'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      {editing ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          aria-label="Karakter adı"
          className="w-full rounded border border-slate-300 px-2 py-1 font-semibold"
        />
      ) : (
        <h3 className="flex items-center gap-2 font-semibold">
          {character.name || 'İsimsiz'}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`${character.name || 'İsimsiz'} adını değiştir`}
            className="text-xs font-normal text-slate-400 underline hover:text-slate-700"
          >
            yeniden adlandır
          </button>
        </h3>
      )}

      <p className="mt-0.5 text-sm text-slate-500">
        {[subrace?.name ?? race?.name, cls?.name].filter(Boolean).join(' ') || 'Tamamlanmamış'}
        {cls && ` · ${totalLevel(character)}. seviye`}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Son düzenleme: {new Date(character.updatedAt).toLocaleString('tr-TR')}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`/karakter/${character.id}`}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Karakter sayfası
        </Link>
        {cls && (
          <Link to={`/seviye/${character.id}`} className={buttonClass}>
            Seviye
          </Link>
        )}
        <button type="button" onClick={() => duplicateCharacter(character.id)} className={buttonClass}>
          Kopyala
        </button>
        <button
          type="button"
          onClick={() =>
            downloadJson(`${safeFileName(character.name)}.json`, buildExport([character]))
          }
          className={buttonClass}
        >
          Dışa aktar
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`"${character.name || 'İsimsiz'}" silinecek. Emin misin?`)) {
              deleteCharacter(character.id)
            }
          }}
          className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-accent"
        >
          Sil
        </button>
      </div>
    </li>
  )
}
