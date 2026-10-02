# VCORE HUD

Resource HUD FiveM untuk QBCore. Minimap memakai radar GTA V asli, widget dapat diatur terpisah, dan kontrol musik berada di dalam minimap.

Repo ini berisi resource yang dipasang sebagai `vcore-hud`. NUI sudah dibuild; server game tidak memerlukan Node.js.

## Fitur

- Minimap kotak atau lingkaran dengan blip dan rute bawaan GTA V.
- Cash, bank, identitas, lokasi, dan status pemain yang independen.
- Speedometer analog, digital, dan berbagai model tanpa latar.
- Pengaturan liquid glass dengan kontrol keyboard.
- Pindahkan seluruh widget atau per ikon; ukuran 50-200% dan toggle tampil/sembunyi.
- Default layout dari server, preset per karakter, serta impor dan ekspor pengaturan.
- Integrasi fuel, voice, kendaraan, dan audio cs-boombox yang dapat dikonfigurasi.

## Instalasi

Persyaratan: FiveM dengan OneSync, QBCore, serta resource fuel dan voice sesuai konfigurasi server.

1. Clone repo ke `resources/[local]/vcore-hud`, atau unduh ZIP GitHub lalu ubah nama folder hasil ekstrak menjadi `vcore-hud`.
2. Untuk musik, pasang cs-boombox dengan patch integrasi sesuai [panduan audio](integrations/README.md). Resource cs-boombox dipasang terpisah.
3. Nonaktifkan HUD lama, termasuk `ensure qb-hud`.
4. Atur urutan startup di `server.cfg` setelah resource fuel dan voice:

```cfg
ensure qb-core
ensure qb-smallresources
ensure qb-vehiclekeys
ensure cs-boombox
ensure vcore-hud
```

Gunakan nama folder `vcore-hud` agar bridge cs-boombox cocok dengan konfigurasi bawaan. Jika musik tidak digunakan, set `Config.Music.Enabled = false` di `services_config.lua`; cs-boombox tidak perlu dijalankan.

## Konfigurasi

| Berkas | Pengaturan |
| --- | --- |
| [config.lua](config.lua) | Framework, fuel, voice, tombol HUD, radar, status, dan default widget |
| [vehicle_config.lua](vehicle_config.lua) | Kendaraan, cruise, handling, transmisi, dan nitro |
| [services_config.lua](services_config.lua) | Musik, kamera helikopter, dan perintah suara |

`Config.Preferences` menentukan posisi, bentuk, ukuran, dan visibilitas awal. Pemain dapat mengubahnya melalui menu HUD. Pengaturan tersimpan per karakter; **Reset HUD** mengembalikan default server.

Fuel dan voice mendukung pemilihan adapter/resource maupun provider khusus. Sabuk dan cruise dapat mengikuti `qb-smallresources`. Kamera helikopter dan perintah suara adalah fitur opsional, terpisah dari indikator voice chat.

## Kontrol

| Konteks | Tombol | Fungsi |
| --- | --- | --- |
| Game | `I` atau `/hudsettings` | Buka pengaturan |
| Game | `/hud` | Tampilkan atau sembunyikan HUD |
| Game | `/vcore-music` | Buka musik di minimap |
| Pengaturan | `Q` / `E` | Ganti tab |
| Pengaturan | `Tab` / `Shift+Tab` | Pilih kontrol |
| Pengaturan | `Enter` / `Space` | Gunakan kontrol |
| Pengaturan | `M` | Buka **Pindahkan widget** |
| Editor | `PgUp` / `PgDn` | Pilih widget atau ikon |
| Editor | Panah / `Shift` + panah | Geser 1 / 10 piksel |
| Editor | `[` / `]` | Ubah ukuran 5% |
| Editor | `H` | Tampilkan atau sembunyikan pilihan |
| Menu | `Esc` | Kembali atau tutup |

Editor menyediakan **Seluruh widget** dan **Per ikon**. Tombol telepon, inventori, sabuk, dan kontrol kendaraan mengikuti resource QBCore yang terpasang. Binding yang disimpan pemain dapat berbeda dari default server.

## Musik

Pemutaran memakai cs-boombox. Pengemudi mengontrol lagu, antrean, volume, dan posisi pemutaran; judul YouTube diambil otomatis. HUD menampilkan kontrol audio tanpa panel video.

Versi upstream cs-boombox memerlukan [patch bridge VCORE](integrations/README.md). Video yang ditolak YouTube tetap dapat gagal, termasuk kode 101/150. Sumber audio server dapat diatur melalui `Config.Music.AllowedMedia` dan `Config.Music.YouTubeAudio`.

## Struktur resource

```text
fxmanifest.lua     Manifest FiveM
config.lua         Pengaturan utama dan default pemain
*_client.lua       Integrasi dan perilaku client
*_server.lua       Validasi dan sinkronisasi server
html/              Source UI dan aset radar
ui/                NUI hasil build yang dimuat FiveM
integrations/      Patch dan panduan dependensi audio
```

`fxmanifest.lua` memuat `ui/index.html`. Folder `html/` tetap diperlukan oleh manifest dan aset radar; simpan keduanya saat memasang resource. Panel Foundation dan kontrol developer disembunyikan di FiveM.

## Status pengujian

Kontrak JavaScript/Lua dan aset NUI telah diperiksa dengan fixture. Radar GTA, keybinding, multiplayer, dan keluaran audio tetap memerlukan pengujian pada server FiveM.

## Atribusi

Audio menggunakan [cs-boombox oleh Critical Scripts](https://github.com/criticalscripts-shop/cs-boombox). Detail sumber, font, dan aset tersedia di [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
