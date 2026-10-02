# Integrasi cs-boombox

VCORE memakai cs-boombox sebagai resource terpisah. Patch ini menambahkan bridge untuk pemutar kendaraan, volume, seek, cleanup, serta pelaporan status dan error ke HUD.

Sumber: [criticalscripts-shop/cs-boombox](https://github.com/criticalscripts-shop/cs-boombox).

Revisi dasar: `2ad1a419bf5abe97c890f2a168821cfa4dfed282`.

## Instalasi baru

Setelah folder `vcore-hud` tersedia, jalankan dari direktori `resources/[local]/`:

```sh
git clone https://github.com/criticalscripts-shop/cs-boombox.git cs-boombox
git -C cs-boombox checkout 2ad1a419bf5abe97c890f2a168821cfa4dfed282
git -C cs-boombox apply --check ../vcore-hud/integrations/cs-boombox.patch
git -C cs-boombox apply ../vcore-hud/integrations/cs-boombox.patch
```

Jalankan perintah penerapan patch hanya setelah pemeriksaan `--check` berhasil. Untuk cs-boombox yang sudah memakai patch VCORE, lewati penerapan ulang.

Tambahkan ke `server.cfg` setelah QBCore dan integrasi kendaraan:

```cfg
ensure cs-boombox
ensure vcore-hud
```

## Konfigurasi

Pengaturan bawaan dalam [services_config.lua](../services_config.lua):

```lua
Config.Music.Adapter = 'cs-boombox'
Config.Music.Resource = 'cs-boombox'
```

Jika folder HUD diganti namanya, set `config.vcoreOwner` di `cs-boombox/config.lua` ke nama baru. Jika folder audio diganti namanya, sesuaikan `Config.Music.Resource`.

## Isi patch

| Berkas cs-boombox | Perubahan |
| --- | --- |
| `server/core.lua` | Export bridge dengan pemeriksaan pemilik dan input |
| `client/core.lua` | Status/error dengan identitas sumber dan generasi pemutar |
| `client/dui/javascript/script.js` | Metadata sumber pada callback audio |
| `client/dui/javascript/controllers/youtube.js` | Error YouTube mempertahankan sumber dan kode aslinya |

Patch tidak mengganti mesin audio cs-boombox. YouTube tetap dapat menolak video; patch tidak menghapus pembatasan pemutaran atau iklan. DUI, audio spasial, dan sinkronisasi multiplayer perlu diuji dalam FiveM.
