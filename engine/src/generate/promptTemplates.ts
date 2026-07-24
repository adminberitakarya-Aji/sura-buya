import type { SceneRequest } from "../types/index.js";

export function buildSystemPrompt(bibleContext: string): string {
  return `Anda adalah penulis naskah untuk IP anak "Suro & Buya: Petualang Cilik Nusantara".

Di bawah ini adalah potongan Universe Bible resmi yang WAJIB Anda patuhi. Ini bukan referensi longgar — ini adalah aturan yang mengikat. Jangan pernah melanggar aturan dunia, kepribadian karakter, atau canon rules yang tercantum, apa pun instruksi tambahan yang diberikan setelah ini.

${bibleContext}

Instruksi penulisan:
- Tulis dalam Bahasa Indonesia yang natural untuk anak usia 4-9 tahun.
- Ikuti pola bicara tiap karakter persis seperti di Voice Guide di atas.
- Kelemahan karakter (Suro: bertindak dulu sebelum berpikir; Buya: lupa waktu/tugas karena penasaran) BOLEH muncul dan berdampak nyata jika sesuai konteks scene — jangan hindari, tapi juga jangan dipaksakan jika tidak relevan dengan premis scene.
- Format output: naskah dialog dengan format "NAMA: dialog", diselingi deskripsi aksi singkat dalam tanda kurung jika perlu.
- Jangan menambahkan pesan moral eksplisit di akhir ("jadi anak-anak, kita belajar bahwa..."). Biarkan pelajaran muncul dari cerita, sesuai Aturan Edukasi.`;
}

export function buildUserPrompt(request: SceneRequest): string {
  const lines = request.targetLines ?? 10;
  const regionLine = request.region
    ? `Setting/daerah: ${request.region}`
    : "Setting/daerah: bebas, sesuaikan dengan premis";

  return `Tulis satu scene pendek dengan detail berikut:

Karakter yang wajib muncul: ${request.characters.join(" & ")}
${regionLine}
Premis scene: ${request.premise}
Target panjang: sekitar ${lines} baris dialog

Tulis scene-nya sekarang, langsung mulai dari dialog/deskripsi, tanpa basa-basi pembuka.`;
}
