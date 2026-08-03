'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Input,
  Textarea,
} from '@suro-buya/ui';
import {
  universesApi,
  charactersApi,
  characterAssetApi,
  type CharacterRole,
  type PersonaDraft,
  type ReferenceGenerateResult,
} from '@/lib/api-client';
import { buildCharacterCreateInput } from '@suro-buya/engine-v2';

export default function CreateCharacterWizardPage() {
  const params = useParams<{ universeId: string }>();
  const universeId = params.universeId;

  // Step state: 1 (Concept) -> 2 (Review) -> 3 (Reference Images)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 State
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [freeText, setFreeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2 State (PersonaDraft)
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Step 3 State (Reference Images)
  const [savedCharacterId, setSavedCharacterId] = useState<string | null>(null);
  const [artStyle, setArtStyle] = useState(
    '2D digital character illustration, vibrant colors, clean lines, turnaround sheet'
  );
  // DB id (Character.id) dari karakter yang berhasil disimpan di Step 2
  const [savedCharacterDbId, setSavedCharacterDbId] = useState<string | null>(null);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const [visualResult, setVisualResult] = useState<ReferenceGenerateResult | null>(null);
  const [visualError, setVisualError] = useState<string | null>(null);

  // Fetch universe details
  const { data: universeData } = useQuery({
    queryKey: ['universe', universeId],
    queryFn: () => universesApi.get(universeId),
  });
  void universeData; // used for query side-effects only

  // Handler Step 1: Parsing Free-Text AI (Opsi A) — via VF-1.8 API endpoint
  async function handleParseFreeText() {
    if (!freeText.trim()) {
      setParseError('Silakan ketik deskripsi karakter terlebih dahulu.');
      return;
    }
    setParseError(null);
    setIsParsing(true);
    try {
      // Kirim ke server-side endpoint VF-1.8 yang meneruskan ke parseFreeTextToPersona()
      // beserta audienceProfile dari konfigurasi universe — tidak ada logika AI di client.
      const response = await charactersApi.parsePersona(universeId, freeText);
      setDraft(response.draft);
      setStep(2);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Gagal memproses deskripsi dengan AI. Coba gunakan opsi manual.'
      );
    } finally {
      setIsParsing(false);
    }
  }

  // Handler Step 1: Lanjut Manual (Opsi B) — build PersonaDraft minimal tanpa AI
  function handleStartManual() {
    const manualDraft: PersonaDraft = {
      draftId: `draft-${Date.now()}`,
      source: 'manual',
      name: 'karakter-baru',
      displayName: 'Karakter Baru',
      role: 'PROTAGONIST',
      species: 'Manusia',
      ageDescriptor: 'dewasa muda',
      description: 'Deskripsikan latar belakang dan kepribadian karakter ini...',
      coreTraits: ['pemberani', 'ramah'],
      coreWeakness: 'mudah percaya pada orang lain',
      voiceGuide: 'nada suara ramah dan hangat',
      visualDescription: 'Pakaian kasual dengan warna dominan biru dan wajah bersahabat',
      fieldsNeedingReview: [],
    };
    setDraft(manualDraft);
    setStep(2);
  }

  // Handler Update Draft Field di Step 2
  function updateDraftField<K extends keyof PersonaDraft>(field: K, value: PersonaDraft[K]) {
    if (!draft) return;
    setDraft({
      ...draft,
      [field]: value,
      fieldsNeedingReview: draft.fieldsNeedingReview.filter((f: string) => f !== field),
    });
  }

  // Handler Step 2: Save to Character Bible & Postgres via existing characters API
  async function handleSaveCharacter() {
    if (!draft) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const input = buildCharacterCreateInput(draft);

      // Buat Character (Bible entry) + CharacterAsset kosong secara ATOMIK lewat
      // nested create di backend (POST /characters). referenceImages diisi nanti
      // di Step 3 via PUT /asset (generateReferenceImages).
      const created = await charactersApi.create(universeId, {
        characterId: input.characterId,
        name: input.characterId,
        displayName: input.displayName,
        role: input.role as CharacterRole,
        description: input.description,
        coreTraits: input.coreTraits,
        coreWeakness: input.coreWeakness,
        voiceGuide: input.voiceGuide,
        // Simpan field persona yang tidak punya kolom Prisma langsung ke metadata
        metadata: input.metadata as Record<string, unknown>,
      });

      const charDbId = created.character.id;

      setSavedCharacterId(created.character.characterId);
      setSavedCharacterDbId(charDbId);
      setStep(3);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Gagal menyimpan karakter ke database. Pastikan slug unik.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  // Handler Step 3: Generate Reference Images via VF-1.8 API endpoint
  async function handleGenerateVisuals() {
    if (!savedCharacterDbId) return;
    setVisualError(null);
    setIsGeneratingVisuals(true);
    try {
      // Server-side: endpoint menggunakan VF-1.6 generateCharacterReferenceImages()
      // dan menyimpan hasilnya ke CharacterAsset.referenceImages secara otomatis
      const response = await characterAssetApi.generateReferenceImages(
        universeId,
        savedCharacterDbId,
        { count: 4, artStyle, saveToAsset: true },
      );
      setVisualResult(response.result);
    } catch (err) {
      setVisualError(err instanceof Error ? err.message : 'Gagal membuat gambar referensi.');
    } finally {
      setIsGeneratingVisuals(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center space-x-3">
          <Link href={`/${universeId}/characters`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create New Character Wizard</h1>
            <p className="text-sm text-muted-foreground">
              Buat karakter baru berbasis persona lengkap untuk dipakai di berbagai episode video
            </p>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className={`p-3 rounded-lg border flex items-center space-x-3 ${
            step === 1 ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            1
          </div>
          <div>
            <div className="font-semibold text-sm">Konsep Persona</div>
            <div className="text-xs">Free-Text AI / Manual</div>
          </div>
        </div>

        <div
          className={`p-3 rounded-lg border flex items-center space-x-3 ${
            step === 2 ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            2
          </div>
          <div>
            <div className="font-semibold text-sm">Review & Lock (Wajib)</div>
            <div className="text-xs">Ulas & simpan ke Bible</div>
          </div>
        </div>

        <div
          className={`p-3 rounded-lg border flex items-center space-x-3 ${
            step === 3 ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            3
          </div>
          <div>
            <div className="font-semibold text-sm">Visual DNA Reference</div>
            <div className="text-xs">Generate 4 visual images</div>
          </div>
        </div>
      </div>

      {/* STEP 1: KONSEP PERSONA */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span>Step 1: Masukkan Konsep Karakter</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  Pilih jalur deskripsi bebas yang di-strukturisasi AI (default) atau langsung isi form manual.
                </CardDescription>
              </div>
              <div className="flex bg-muted p-1 rounded-md">
                <Button
                  size="sm"
                  variant={mode === 'ai' ? 'default' : 'ghost'}
                  onClick={() => setMode('ai')}
                >
                  <Sparkles className="w-4 h-4 mr-1" /> Opsi A: Free-Text AI
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'manual' ? 'default' : 'ghost'}
                  onClick={() => setMode('manual')}
                >
                  <FileText className="w-4 h-4 mr-1" /> Opsi B: Form Manual
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'ai' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ceritakan Karaktermu (Teks Bebas)</label>
                  <Textarea
                    rows={6}
                    placeholder="Contoh: Kiko adalah seekor anak kelinci berusia 8 tahun yang selalu memakai syal merah kesayangannya. Dia pemberani dan penuh rasa ingin tahu, tetapi sering ceroboh saat terlalu gembira..."
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ketik deskripsi santai tentang nama, sifat, penampilan, kelemahan, dan cara bicaranya. Claude LLM akan menstrukturisasikannya menjadi PersonaDraft.
                  </p>
                </div>

                {parseError && (
                  <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-md text-sm flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                  <Button onClick={handleParseFreeText} disabled={isParsing}>
                    {isParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menstrukturkan Persona...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" /> Strukturkan dengan AI & Lanjut ke Step 2
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-lg">Form Manual (Kontrol 100%)</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Anda dapat langsung mengisi seluruh struktur PersonaDraft secara manual dari awal tanpa proses ekstraksi AI.
                  </p>
                </div>
                <Button onClick={handleStartManual}>
                  Isi Form Manual di Step 2 →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: REVIEW & LOCK PERSONA (WAJIB) */}
      {step === 2 && draft && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span>Step 2: Review & Lock Persona Karakter (Wajib)</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  Koreksi dan lengkapi persona sebelum di-lock secara permanen ke Character Bible.
                </CardDescription>
              </div>
              <Badge variant="outline" className="uppercase text-xs font-mono">
                Source: {draft.source}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {draft.fieldsNeedingReview.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md text-amber-800 dark:text-amber-200 text-sm flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">AI Menebak/Memperkirakan Beberapa Field</div>
                  <div className="text-xs mt-0.5">
                    Harap periksa ulang field dengan tanda badge <span className="font-bold">⚠️ Perlu Dicek</span> berikut: {draft.fieldsNeedingReview.join(', ')}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Internal Slug */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Slug Internal (characterId)
                </label>
                <Input
                  value={draft.name}
                  onChange={(e) => updateDraftField('name', e.target.value)}
                  placeholder="mis. kiko"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Nama Tampilan</span>
                  {draft.fieldsNeedingReview.includes('displayName') && (
                    <Badge variant="destructive" className="text-[10px] py-0">⚠️ Perlu Dicek</Badge>
                  )}
                </label>
                <Input
                  value={draft.displayName}
                  onChange={(e) => updateDraftField('displayName', e.target.value)}
                  placeholder="mis. Kiko si Kelinci"
                />
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Peran Naratif
                </label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={draft.role}
                  onChange={(e) => updateDraftField('role', e.target.value as CharacterRole)}
                >
                  <option value="PROTAGONIST">PROTAGONIST (Karakter Utama)</option>
                  <option value="DEUTERAGONIST">DEUTERAGONIST (Pendamping Utama)</option>
                  <option value="SUPPORTING">SUPPORTING (Pendukung)</option>
                  <option value="ANTAGONIST">ANTAGONIST (Lawan/Konflik)</option>
                  <option value="NARRATOR">NARRATOR (Narator)</option>
                </select>
              </div>

              {/* Species */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Spesies / Jenis</span>
                  {draft.fieldsNeedingReview.includes('species') && (
                    <Badge variant="destructive" className="text-[10px] py-0">⚠️ Perlu Dicek</Badge>
                  )}
                </label>
                <Input
                  value={draft.species}
                  onChange={(e) => updateDraftField('species', e.target.value)}
                  placeholder="mis. Kelinci, Manusia, Robot"
                />
              </div>

              {/* Age Descriptor */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Deskripsi Umur Naratif</span>
                  {draft.fieldsNeedingReview.includes('ageDescriptor') && (
                    <Badge variant="destructive" className="text-[10px] py-0">⚠️ Perlu Dicek</Badge>
                  )}
                </label>
                <Input
                  value={draft.ageDescriptor}
                  onChange={(e) => updateDraftField('ageDescriptor', e.target.value)}
                  placeholder="mis. anak-anak, sekitar 8 tahun"
                />
              </div>

              {/* Description */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Deskripsi Karakter</span>
                  {draft.fieldsNeedingReview.includes('description') && (
                    <Badge variant="destructive" className="text-[10px] py-0">⚠️ Perlu Dicek</Badge>
                  )}
                </label>
                <Textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => updateDraftField('description', e.target.value)}
                />
              </div>

              {/* Core Traits */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Sifat Inti (Pisahkan dengan Koma)</span>
                  {draft.fieldsNeedingReview.includes('coreTraits') && (
                    <Badge variant="destructive" className="text-[10px] py-0">⚠️ Perlu Dicek</Badge>
                  )}
                </label>
                <Input
                  value={draft.coreTraits.join(', ')}
                  onChange={(e) =>
                    updateDraftField(
                      'coreTraits',
                      e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  placeholder="mis. pemberani, ramah, selalu ingin tahu"
                />
              </div>

              {/* Core Weakness */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Kelemahan / Ketakutan Utama (Wajib)</span>
                  {draft.fieldsNeedingReview.includes('coreWeakness') && (
                    <Badge variant="destructive" className="text-[10px] py-0">⚠️ Perlu Dicek</Badge>
                  )}
                </label>
                <Textarea
                  rows={2}
                  value={draft.coreWeakness}
                  onChange={(e) => updateDraftField('coreWeakness', e.target.value)}
                  placeholder="Apa kelemahan atau hal yang ditakuti karakter ini?"
                />
              </div>

              {/* Voice Guide */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Panduan Suara / Cara Bicara</span>
                  {draft.fieldsNeedingReview.includes('voiceGuide') && (
                    <Badge variant="destructive" className="text-[10px] py-0">⚠️ Perlu Dicek</Badge>
                  )}
                </label>
                <Input
                  value={draft.voiceGuide}
                  onChange={(e) => updateDraftField('voiceGuide', e.target.value)}
                  placeholder="mis. suara anak-anak riang dengan tempo cepat"
                />
              </div>

              {/* Visual Description */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Deskripsi Visual Physical (Bahan Reference Generator Step 3)</span>
                  {draft.fieldsNeedingReview.includes('visualDescription') && (
                    <Badge variant="destructive" className="text-[10px] py-0">⚠️ Perlu Dicek</Badge>
                  )}
                </label>
                <Textarea
                  rows={3}
                  value={draft.visualDescription}
                  onChange={(e) => updateDraftField('visualDescription', e.target.value)}
                  placeholder="Detail warna bulu/kulit, pakaian, bentuk mata, dan aksesoris khas..."
                />
              </div>
            </div>

            {saveError && (
              <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-md text-sm flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← Kembali ke Step 1
              </Button>
              <Button onClick={handleSaveCharacter} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Lock ke Character Bible
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: VISUAL REFERENCE GENERATION */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-1" />
                  <span>Step 3: Character Visual DNA Reference</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  Karakter telah berhasil disimpan ke Character Bible! Sekarang generate gambar referensi visual (turnaround).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 p-4 bg-muted/40 rounded-lg border">
              <label className="text-sm font-semibold">Gaya Visual (Art Style Prompt)</label>
              <Input
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                placeholder="mis. 2D digital character illustration, vibrant colors, turnaround sheet"
              />
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Akan membuat 4 referensi sudut pandang: Tampak Depan, Profil 3/4, Full Body, & Dynamic Pose.
                </p>
                <Button onClick={handleGenerateVisuals} disabled={isGeneratingVisuals}>
                  {isGeneratingVisuals ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> Generate 4 Reference Images
                    </>
                  )}
                </Button>
              </div>
            </div>

            {visualError && (
              <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-md text-sm flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{visualError}</span>
              </div>
            )}

            {visualResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">Hasil Referensi Visual Karakter</h3>
                  <Badge variant="secondary">
                    Provider: {visualResult.providerUsed} (Est. Cost: ${visualResult.totalCost})
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {visualResult.promptsUsed.map((spec, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2 bg-card">
                      <div className="aspect-square bg-muted rounded-md flex items-center justify-center relative overflow-hidden border">
                        <img
                          src={visualResult.referenceImages[i]}
                          alt={spec.description}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center text-xs text-muted-foreground bg-muted/80">
                          <ImageIcon className="w-6 h-6 mb-1 text-primary" />
                          <span className="font-semibold text-foreground">{spec.angle}</span>
                          <span className="text-[10px] line-clamp-2 mt-0.5">{spec.description}</span>
                        </div>
                      </div>
                      <div className="text-[11px] font-medium text-muted-foreground truncate" title={spec.description}>
                        {spec.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Link href={`/${universeId}/characters`}>
                <Button variant="default">
                  Selesai & Buka Character Bible →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
