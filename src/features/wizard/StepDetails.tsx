import type { Character } from '../../rules/character.ts'
import { useCharacterStore } from '../../state/characterStore.ts'
import Section from './Section.tsx'

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
]

export default function StepDetails({ character }: { character: Character }) {
  const { setName, setNote } = useCharacterStore()

  return (
    <div className="space-y-6">
      <Section title="İsim" hint="Karakterini kaydetmek için bir isim gerekiyor.">
        <input
          type="text"
          value={character.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Karakterinin adı"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </Section>

      <Section title="Alignment" hint="İsteğe bağlı. Karakterin ahlaki duruşu.">
        <select
          value={character.notes.alignment}
          onChange={(e) => setNote('alignment', e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Seçilmedi</option>
          {ALIGNMENTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </Section>

      <Section title="Görünüş" hint="İsteğe bağlı.">
        <textarea
          value={character.notes.appearance}
          onChange={(e) => setNote('appearance', e.target.value)}
          rows={3}
          placeholder="Boy, yaş, saç rengi, dikkat çeken bir detay…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Section>

      <Section title="Kişilik" hint="İsteğe bağlı.">
        <textarea
          value={character.notes.personality}
          onChange={(e) => setNote('personality', e.target.value)}
          rows={3}
          placeholder="Nasıl davranır, neye inanır, neyden korkar?"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Section>

      <Section title="Geçmiş hikâyesi" hint="İsteğe bağlı.">
        <textarea
          value={character.notes.backstory}
          onChange={(e) => setNote('backstory', e.target.value)}
          rows={5}
          placeholder="Buraya gelene kadar başına neler geldi?"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Section>
    </div>
  )
}
