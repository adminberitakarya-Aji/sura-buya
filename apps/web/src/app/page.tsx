import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <section className="text-center mb-20">
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6">
            Suro-Buya <span className="text-primary-600">AI Factory</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Multi-universe AI Factory untuk Creator IP Anak-Anak Indonesia.
            Dari bible universe hingga episode siap produksi — end-to-end.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signin"
              className="bg-primary-600 text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Mulai Sekarang
            </Link>
            <Link
              href="/docs"
              className="bg-secondary text-secondary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
            >
              Dokumentasi
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="grid md:grid-cols-3 gap-8 mb-20">
          <FeatureCard
            title="Universe Bible Manager"
            description="Kelola character, world, story bible dengan version control & validasi kanonisasi otomatis."
            icon="📚"
          />
          <FeatureCard
            title="AI Episode Generator"
            description="Generate episode & scene dengan multi-provider AI (Claude, GPT-4o, Cohere) + fallback otomatis."
            icon="🤖"
          />
          <FeatureCard
            title="Canon Validator"
            description="Rule-engine + LLM judge untuk konsistensi karakter, world-building, dan aturan universe."
            icon="✅"
          />
        </section>

        {/* Workflow */}
        <section className="mb-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Workflow Creator</h2>
          <div className="grid md:grid-cols-5 gap-4">
            {[
              { step: 1, title: 'Buat Universe', desc: 'Wizard 5 langkah' },
              { step: 2, title: 'Tulis Bible', desc: 'Character, World, Story' },
              { step: 3, title: 'Rencanakan', desc: 'Season & Episode Arc' },
              { step: 4, title: 'Generate', desc: 'Scene dengan AI' },
              { step: 5, title: 'Review & Approve', desc: 'Kanonisasi & Publikasi' },
            ].map(({ step, title, desc }) => (
              <WorkflowStep key={step} step={step} title={title} desc={desc} />
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center p-12 bg-primary-600 rounded-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Siap Membangun Universe Anda?
          </h2>
          <p className="text-primary-100 mb-8 max-w-2xl mx-auto">
            Bergabung dengan komunitas creator IP anak-anak Indonesia yang memanfaatkan AI
            untuk mempercepat produksi berkualitas.
          </p>
          <Link
            href="/auth/signin"
            className="bg-primary-foreground text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-100 transition-colors inline-block"
          >
            Daftar Gratis
          </Link>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-card p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function WorkflowStep({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-primary-600 text-primary-foreground flex items-center justify-center text-xl font-bold z-10">
        {step}
      </div>
      <div className="pt-16 text-center">
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {step < 5 && (
        <div className="absolute top-4 right-0 w-full h-0.5 bg-border hidden md:block" />
      )}
    </div>
  );
}