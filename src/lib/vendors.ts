// Vendor directory — post-production facilities, film labs, VFX, audio, DCP/QC,
// camera rental, plus the global software/hardware the post world runs on.
// Sourced from the NZ Post-Super Master Reference (NZ) + web research (AU, UK,
// France, Germany, Singapore, global), each verified as currently operating at
// time of research. Companies change fast — confirm current status before relying on it.

export type VendorType =
  | "Post facility" | "Film lab" | "Colour" | "VFX" | "Audio"
  | "DCP/QC" | "Camera rental" | "Software" | "Hardware" | "Storage/transfer";

export type VendorRegion = "AU" | "NZ" | "UK" | "France" | "Germany" | "Singapore" | "Global";

export interface Vendor {
  name: string;
  type: VendorType;
  region: VendorRegion;
  city?: string;
  blurb: string;
  url: string;
}

export const VENDOR_TYPES: VendorType[] = [
  "Post facility", "Colour", "VFX", "Audio", "Film lab", "DCP/QC", "Camera rental", "Software", "Hardware", "Storage/transfer",
];

export const VENDOR_REGIONS: VendorRegion[] = ["AU", "NZ", "UK", "France", "Germany", "Singapore", "Global"];

export const VENDOR_REGION_LABEL: Record<VendorRegion, string> = {
  AU: "Australia", NZ: "New Zealand", UK: "United Kingdom", France: "France",
  Germany: "Germany", Singapore: "Singapore", Global: "Global",
};

export const VENDOR_TYPE_COLOR: Record<VendorType, string> = {
  "Post facility": "#22d3ee",
  "Colour": "#a78bfa",
  "VFX": "#2dd4bf",
  "Audio": "#38bdf8",
  "Film lab": "#f59e0b",
  "DCP/QC": "#fb7185",
  "Camera rental": "#4ade80",
  "Software": "#818cf8",
  "Hardware": "#94a3b8",
  "Storage/transfer": "#fbbf24",
};

export const VENDORS: Vendor[] = [
  // ---- New Zealand ----
  { name: "Park Road Post", type: "Post facility", region: "NZ", city: "Wellington", blurb: "Feature sound, picture finishing, VFX, restoration", url: "https://www.parkroad.co.nz" },
  { name: "Department of Post", type: "Post facility", region: "NZ", city: "Auckland", blurb: "Editorial, finishing, audio, QC under one roof", url: "https://www.departmentofpost.com" },
  { name: "Images & Sound", type: "Post facility", region: "NZ", city: "Auckland", blurb: "NZ's longest-running post house; grade, VFX, Atmos", url: "https://www.imagesandsound.co.nz" },
  { name: "Digipost", type: "Post facility", region: "NZ", city: "Auckland", blurb: "Online finishing, VFX and dailies for features/TV", url: "https://digipost.co.nz" },
  { name: "Wētā FX", type: "VFX", region: "NZ", city: "Wellington", blurb: "World-leading feature visual effects and animation", url: "https://www.wetafx.co.nz" },
  { name: "Toybox", type: "VFX", region: "NZ", city: "Auckland", blurb: "VFX, animation and long-form finishing studio", url: "https://www.toybox.co.nz" },
  { name: "Blockhead", type: "VFX", region: "NZ", city: "Auckland", blurb: "VFX, CG and design for commercials and screen", url: "https://www.blockheadvfx.com" },
  { name: "Rocket Rentals", type: "Camera rental", region: "NZ", city: "Auckland", blurb: "Camera, lighting and crew hire", url: "https://www.rocketrentals.com" },
  { name: "Portsmouth", type: "Camera rental", region: "NZ", city: "Wellington", blurb: "Lighting, RED camera and film consumables hire", url: "https://portsmouth.co.nz" },

  // ---- Australia ----
  { name: "Spectrum Films", type: "Post facility", region: "AU", city: "Sydney", blurb: "Picture, sound and VFX; family-run since 1964", url: "https://spectrumfilms.com.au" },
  { name: "Eden Studios", type: "Colour", region: "AU", city: "Sydney", blurb: "Dolby Vision / Atmos grade and finish facility", url: "https://edenstudios.com.au" },
  { name: "Rising Sun Pictures", type: "VFX", region: "AU", city: "Adelaide", blurb: "Hollywood feature VFX; Adelaide and Brisbane", url: "https://rsp.com.au" },
  { name: "FIN Design + Effects", type: "VFX", region: "AU", city: "Sydney", blurb: "VFX and design; Sydney, Melbourne, Gold Coast", url: "https://www.findesign.com.au" },
  { name: "Alt.VFX", type: "VFX", region: "AU", city: "Brisbane", blurb: "VFX and virtual production", url: "https://www.altvfx.com" },
  { name: "Luma Pictures", type: "VFX", region: "AU", city: "Melbourne", blurb: "Independent feature-film visual effects studio", url: "https://www.lumapictures.com" },
  { name: "Framestore Melbourne", type: "VFX", region: "AU", city: "Melbourne", blurb: "High-end feature VFX (formerly Method Studios)", url: "https://www.framestore.com" },
  { name: "Heckler", type: "VFX", region: "AU", city: "Sydney", blurb: "VFX, CGI, design, animation, edit and colour", url: "https://heckler.tv" },
  { name: "Soundfirm", type: "Audio", region: "AU", city: "Melbourne", blurb: "Sound mix, ADR, Atmos; Melbourne and Sydney", url: "https://www.soundfirm.com" },
  { name: "Trackdown", type: "Audio", region: "AU", city: "Sydney", blurb: "Scoring stage, ADR, Foley, sound post", url: "https://trackdown.com.au" },
  { name: "ROAR Digital", type: "Film lab", region: "AU", city: "Melbourne", blurb: "Film scanning, grading, restoration and mastering", url: "https://roardigital.com.au" },
  { name: "Nano Lab", type: "Film lab", region: "AU", city: "Daylesford", blurb: "Super 8 motion-picture film processing and supply", url: "https://nanolab.com.au" },
  { name: "Rewind Photo Lab", type: "Film lab", region: "AU", city: "Sydney", blurb: "Super 8 and 16mm ECN-2 processing and scanning", url: "https://rewindphotolab.com.au" },
  { name: "FATS", type: "DCP/QC", region: "AU", city: "Sydney", blurb: "DCP mastering, QC, deliverables and distribution", url: "https://fats.com.au" },
  { name: "The Finishing Room", type: "DCP/QC", region: "AU", city: "Sydney", blurb: "DCP mastering and Dolby-tested cinema deliverables", url: "https://www.finishingroom.com.au" },
  { name: "Unravel", type: "DCP/QC", region: "AU", city: "Melbourne", blurb: "Cinema-ready DCP mastering for films and trailers", url: "https://www.unravel.com.au" },
  { name: "Post Lab", type: "DCP/QC", region: "AU", city: "Melbourne", blurb: "2K/4K DCP creation and worldwide distribution", url: "https://www.postlab.io" },
  { name: "Panavision Australia", type: "Camera rental", region: "AU", city: "Sydney", blurb: "Cinema camera, lens, grip and lighting rental", url: "https://www.panavision.com.au" },
  { name: "Lemac", type: "Camera rental", region: "AU", city: "Melbourne", blurb: "Camera and digital cinema rental", url: "https://www.lemac.com.au" },

  // ---- United Kingdom ----
  { name: "Goldcrest Post", type: "Post facility", region: "UK", city: "London", blurb: "Feature/TV picture and sound finishing, Soho", url: "https://goldcrestfilms.com/post-production" },
  { name: "Molinare", type: "Post facility", region: "UK", city: "London", blurb: "Soho picture, sound, VFX, DI", url: "https://molinare.co.uk" },
  { name: "Envy Post Production", type: "Post facility", region: "UK", city: "London", blurb: "Online, grading, audio — Fitzrovia post house", url: "https://www.envypost.co.uk" },
  { name: "The Farm", type: "Post facility", region: "UK", city: "London", blurb: "Picture and sound post; Soho and Cardiff", url: "https://farmgroup.tv" },
  { name: "Halo Post Production", type: "Post facility", region: "UK", city: "London", blurb: "Grading, online, sound — Soho post", url: "https://www.halopost.com" },
  { name: "OnSight", type: "Post facility", region: "UK", city: "London", blurb: "Dailies, picture post, VFX, sound", url: "https://onsight.co.uk" },
  { name: "Picture Shop", type: "Post facility", region: "UK", city: "London", blurb: "Editorial, colour, sound, VFX, dailies", url: "https://www.pictureshop.com" },
  { name: "Films at 59", type: "Post facility", region: "UK", city: "Bristol", blurb: "Picture/sound post and equipment hire", url: "https://filmsat59.com" },
  { name: "Twickenham Film Studios", type: "Post facility", region: "UK", city: "London", blurb: "Sound dubbing, ADR, cutting rooms", url: "https://www.twickenhamstudios.com" },
  { name: "Company 3 London", type: "Colour", region: "UK", city: "London", blurb: "Feature/episodic colour grading, Chancery Lane", url: "https://www.company3.com/locations/london" },
  { name: "Mission Digital", type: "Colour", region: "UK", city: "Shepperton", blurb: "HDR grading, dailies and DIT services", url: "https://www.missiondigital.co.uk" },
  { name: "Coffee & TV", type: "Colour", region: "UK", city: "London", blurb: "Colour, VFX and finishing for film/TV", url: "https://coffeeand.tv" },
  { name: "Framestore", type: "VFX", region: "UK", city: "London", blurb: "Oscar-winning feature and episodic VFX", url: "https://www.framestore.com" },
  { name: "DNEG", type: "VFX", region: "UK", city: "London", blurb: "Academy Award-winning VFX, Fitzrovia", url: "https://www.dneg.com" },
  { name: "Cinesite", type: "VFX", region: "UK", city: "London", blurb: "Feature VFX and animation studio", url: "https://cinesite.com" },
  { name: "MPC", type: "VFX", region: "UK", city: "London", blurb: "Blockbuster VFX and animation, Soho", url: "https://www.moving-picture.com" },
  { name: "ILM London", type: "VFX", region: "UK", city: "London", blurb: "Lucasfilm feature and episodic VFX", url: "https://www.ilm.com/locations/london" },
  { name: "Milk VFX", type: "VFX", region: "UK", city: "London", blurb: "Episodic and feature VFX, Clerkenwell", url: "https://www.milk-vfx.com" },
  { name: "Union VFX", type: "VFX", region: "UK", city: "London", blurb: "Invisible effects and CG environments, Soho", url: "https://www.unionvfx.com" },
  { name: "Outpost VFX", type: "VFX", region: "UK", city: "Bournemouth", blurb: "Environments, creatures and digital makeup VFX", url: "https://www.outpost-vfx.com" },
  { name: "Warner Bros De Lane Lea", type: "Audio", region: "UK", city: "London", blurb: "Sound and picture post, Soho", url: "https://www.wbsl.com/de-lane-lea" },
  { name: "Hackenbacker", type: "Audio", region: "UK", city: "London", blurb: "Sound design, ADR, foley, mixing", url: "https://www.hackenbacker.com" },
  { name: "Boom Post", type: "Audio", region: "UK", city: "London", blurb: "Sound editing, foley, ADR, mixing", url: "https://www.boompost.co.uk" },
  { name: "Cinelab Film & Digital", type: "Film lab", region: "UK", city: "Slough", blurb: "16/35/65mm processing, scanning, restoration", url: "https://www.cinelab.co.uk" },
  { name: "Kodak Film Lab London", type: "Film lab", region: "UK", city: "Iver Heath", blurb: "Motion picture processing and scanning, Pinewood", url: "https://www.kodak.com/en/motion/page/kodak-film-labs" },
  { name: "Dragon Digital Intermediate", type: "Film lab", region: "UK", city: "Bridgend", blurb: "Film scanning, restoration, DI, DCP mastering", url: "https://dragondi.co.uk" },
  { name: "R3store Studios", type: "Film lab", region: "UK", city: "London", blurb: "Film restoration, scanning, grading, telecine", url: "https://r3storestudios.com" },
  { name: "Deluxe London", type: "DCP/QC", region: "UK", city: "London", blurb: "DCP mastering, QC, cinema distribution", url: "https://www.bydeluxe.com" },
  { name: "ARRI Rental UK", type: "Camera rental", region: "UK", city: "Uxbridge", blurb: "Camera, lighting and grip rental", url: "https://www.arrirental.co.uk" },
  { name: "Panavision UK", type: "Camera rental", region: "UK", city: "Greenford", blurb: "Cinema camera, lens and grip rental", url: "https://uk.panavision.com" },
  { name: "Movietech Camera Rentals", type: "Camera rental", region: "UK", city: "Iver Heath", blurb: "Camera and grip rental, Pinewood", url: "https://www.movietech.co.uk" },
  { name: "Procam Take 2", type: "Camera rental", region: "UK", city: "London", blurb: "Digital cinematography camera and kit hire", url: "https://procamtake2.com" },

  // ---- France ----
  { name: "Eclair", type: "DCP/QC", region: "France", city: "Vanves", blurb: "Post, restoration, DCP mastering, versioning, delivery", url: "https://eclair.digital" },
  { name: "Hiventy (TransPerfect)", type: "DCP/QC", region: "France", city: "Joinville-le-Pont", blurb: "Localization, dubbing, subtitling, restoration, DCP", url: "https://www.hiventy.com" },
  { name: "Le Labo Paris", type: "Post facility", region: "France", city: "Paris", blurb: "Boutique finishing — conform, grading, VFX", url: "http://lelabo.paris" },
  { name: "Cosmodigital", type: "Post facility", region: "France", city: "Paris", blurb: "Film and digital post, shoot to delivery", url: "https://www.cosmo-digital.com" },
  { name: "M141", type: "Colour", region: "France", city: "Paris", blurb: "Feature-film grading house (Titane, Palme d'Or)", url: "http://www.m141.fr" },
  { name: "MPC Paris", type: "VFX", region: "France", city: "Paris", blurb: "High-end VFX for features and series (ex-Mikros)", url: "https://www.mpcvfx.com" },
  { name: "Mac Guff", type: "VFX", region: "France", city: "Paris", blurb: "Veteran Paris VFX and animation studio", url: "https://macguff.com" },
  { name: "BUF", type: "VFX", region: "France", city: "Paris", blurb: "Pioneering French CGI and visual effects house", url: "https://buf.com" },
  { name: "Digital District", type: "VFX", region: "France", city: "Paris", blurb: "VFX, post-production and colour grading", url: "https://www.digital-district.fr" },
  { name: "L'Image Retrouvée", type: "Film lab", region: "France", city: "Paris", blurb: "Film restoration, scanning, 4K grading", url: "https://imageretrouvee.fr" },
  { name: "Poly Son", type: "Audio", region: "France", city: "Paris", blurb: "Picture and sound post, Dolby Atmos mixing", url: "https://polyson.fr" },
  { name: "Piste Rouge", type: "Audio", region: "France", city: "Paris", blurb: "Sound design, music, Dolby Atmos mixing", url: "https://pisterouge.com" },
  { name: "Dubbing Brothers", type: "Audio", region: "France", city: "Saint-Denis", blurb: "French-language dubbing for film and TV", url: "https://www.dubbing-brothers.com" },
  { name: "RVZ", type: "Camera rental", region: "France", city: "Ivry-sur-Seine", blurb: "Camera, lens and lighting rental, Paris", url: "https://rvz-location.fr" },
  { name: "TSF", type: "Camera rental", region: "France", city: "Paris", blurb: "Camera, grip, lighting, studios and backlots", url: "https://groupe-tsf.com" },
  { name: "Transpacam", type: "Camera rental", region: "France", city: "Gennevilliers", blurb: "Camera and lens rental for film, TV", url: "https://www.transpacam.com" },

  // ---- Germany ----
  { name: "Cine Plus", type: "Post facility", region: "Germany", city: "Berlin", blurb: "Full-service production, post and rental", url: "https://www.cine-plus.de" },
  { name: "The Post Republic", type: "Post facility", region: "Germany", city: "Berlin", blurb: "DI, grading, VFX, sound for international productions", url: "https://post-republic.com" },
  { name: "PHAROS (ex-ARRI Media)", type: "Post facility", region: "Germany", city: "Munich", blurb: "Germany's largest post house; VFX, grade, mastering", url: "https://www.pharos.de" },
  { name: "CinePostproduction", type: "Post facility", region: "Germany", city: "Unterföhring", blurb: "Film processing, dailies, grading, DCP, sound", url: "https://cinepostproduction.de" },
  { name: "Trixter", type: "VFX", region: "Germany", city: "Munich", blurb: "High-end VFX and animation (Marvel features)", url: "https://www.trixter.de" },
  { name: "RISE Visual Effects", type: "VFX", region: "Germany", city: "Berlin", blurb: "Major central-European VFX studio", url: "https://www.risefx.com" },
  { name: "Scanline VFX (Eyeline)", type: "VFX", region: "Germany", city: "Munich", blurb: "Award-winning VFX, founded in Munich", url: "https://www.scanlinevfx.com" },
  { name: "Pixomondo", type: "VFX", region: "Germany", city: "Frankfurt", blurb: "Emmy-winning VFX and virtual production", url: "https://pixomondo.com" },
  { name: "Optical Art", type: "VFX", region: "Germany", city: "Hamburg", blurb: "VFX and post for cinema and TV", url: "https://www.opticalart.de" },
  { name: "Andec Filmtechnik", type: "Film lab", region: "Germany", city: "Berlin", blurb: "Photochemical lab; 16/35mm processing, scanning", url: "https://andecfilm.de" },
  { name: "Rotor Film", type: "Audio", region: "Germany", city: "Potsdam", blurb: "Sound post; one of Europe's largest Atmos stages", url: "https://rotor-film.com" },
  { name: "toneworx", type: "Audio", region: "Germany", city: "Hamburg", blurb: "Dubbing, sound design, Dolby Atmos mix", url: "https://www.toneworx.com" },
  { name: "DCP Manufaktur", type: "DCP/QC", region: "Germany", city: "Berlin", blurb: "Specialist DCP encoding and mastering", url: "https://dcpmanufaktur.com" },
  { name: "ARRI Rental", type: "Camera rental", region: "Germany", city: "Ismaning", blurb: "Camera, lighting and grip rental across Europe", url: "https://www.arrirental.com" },
  { name: "Ludwig Kameraverleih", type: "Camera rental", region: "Germany", city: "Munich", blurb: "Leading German camera rental, Panavision partner", url: "https://ludwigkamera.de" },
  { name: "FGV Schmidle", type: "Camera rental", region: "Germany", city: "Munich", blurb: "Camera, lighting and grip rental house", url: "https://fgv-rental.de" },

  // ---- Singapore ----
  { name: "Infinite Studios", type: "Post facility", region: "Singapore", city: "Singapore", blurb: "Soundstages, post, VFX and animation hub", url: "https://www.infinitestudios.com.sg" },
  { name: "Nine-V Post Production", type: "Post facility", region: "Singapore", city: "Singapore", blurb: "Edit, grade, DCP, QC, Dolby Vision", url: "https://www.nine-v.com" },
  { name: "Mark Song Grades", type: "Colour", region: "Singapore", city: "Singapore", blurb: "Dolby Vision-certified senior feature colourist", url: "https://marksonggrades.com" },
  { name: "VHQ Media", type: "VFX", region: "Singapore", city: "Singapore", blurb: "One of Asia's largest VFX/post houses", url: "https://www.vhqmedia.com" },
  { name: "Vividthree Productions", type: "VFX", region: "Singapore", city: "Singapore", blurb: "VFX, CG animation and immersive content", url: "https://www.vividthree.com" },
  { name: "One Animation", type: "VFX", region: "Singapore", city: "Singapore", blurb: "CG animation studio behind Oddbods", url: "https://www.oneanimation.com" },
  { name: "Yellow Box Studios", type: "Audio", region: "Singapore", city: "Singapore", blurb: "Top Singapore sound post and music studio", url: "http://www.yellowboxstudios.com" },
  { name: "Doppler Soundlab", type: "Audio", region: "Singapore", city: "Singapore", blurb: "Dolby Atmos audio post for film/TV", url: "https://doppler.sg" },
  { name: "Mocha Chai Laboratories", type: "DCP/QC", region: "Singapore", city: "Singapore", blurb: "Boutique film lab; DCP, QC, Dolby Vision/Atmos", url: "https://mochachailab.com" },
  { name: "Camwerkz", type: "Camera rental", region: "Singapore", city: "Singapore", blurb: "Singapore's main cinema camera rental hub", url: "https://camwerkz.com" },

  // ---- Global software ----
  { name: "Blackmagic Design", type: "Software", region: "Global", city: "Melbourne", blurb: "DaVinci Resolve — edit, grade, VFX, deliver", url: "https://www.blackmagicdesign.com" },
  { name: "Avid", type: "Software", region: "Global", city: "Burlington", blurb: "Media Composer editing and production tools", url: "https://www.avid.com" },
  { name: "Adobe", type: "Software", region: "Global", city: "San Jose", blurb: "Premiere Pro and Frame.io review workflow", url: "https://www.adobe.com" },
  { name: "Autodesk", type: "Software", region: "Global", city: "San Francisco", blurb: "Flame finishing and Flow production tracking", url: "https://www.autodesk.com" },
  { name: "FilmLight", type: "Software", region: "Global", city: "London", blurb: "Baselight colour grading and finishing systems", url: "https://www.filmlight.ltd.uk" },
  { name: "Foundry", type: "Software", region: "Global", city: "London", blurb: "Nuke node-based compositing and VFX", url: "https://www.foundry.com" },
  { name: "Colorfront", type: "Software", region: "Global", city: "Budapest", blurb: "Transkoder mastering, dailies and QC tools", url: "https://colorfront.com" },
  { name: "Pomfort", type: "Software", region: "Global", city: "Munich", blurb: "Silverstack on-set data management software", url: "https://pomfort.com" },
  { name: "Assimilate", type: "Software", region: "Global", city: "Pittsburgh", blurb: "Scratch dailies, grading and finishing", url: "https://www.assimilateinc.com" },
  { name: "Colourlab AI", type: "Software", region: "Global", city: "New York", blurb: "AI-assisted colour grading and matching", url: "https://colourlab.ai" },
  { name: "Telestream", type: "Software", region: "Global", city: "Nevada City", blurb: "Vantage media processing, transcode and QC", url: "https://www.telestream.com" },

  // ---- Global hardware ----
  { name: "ARRI", type: "Hardware", region: "Global", city: "Munich", blurb: "Alexa cinema cameras, lenses and lighting", url: "https://www.arri.com" },
  { name: "RED Digital Cinema", type: "Hardware", region: "Global", city: "Foothill Ranch", blurb: "High-resolution digital cinema cameras", url: "https://www.red.com" },
  { name: "Sony Cinema", type: "Hardware", region: "Global", city: "Tokyo", blurb: "VENICE and CineAlta digital cinema cameras", url: "https://pro.sony" },
  { name: "Codex", type: "Hardware", region: "Global", city: "London", blurb: "High-end camera recording media and workflow", url: "https://codex.online" },
  { name: "AJA Video Systems", type: "Hardware", region: "Global", city: "Grass Valley", blurb: "Video I/O, conversion and Ki Pro recorders", url: "https://www.aja.com" },
  { name: "Atomos", type: "Hardware", region: "Global", city: "Melbourne", blurb: "Ninja and Shogun monitor-recorders", url: "https://www.atomos.com" },
  { name: "Teradek", type: "Hardware", region: "Global", city: "Irvine", blurb: "Wireless video transmission and streaming", url: "https://teradek.com" },

  // ---- Global storage / transfer ----
  { name: "IBM Aspera", type: "Storage/transfer", region: "Global", city: "Armonk", blurb: "High-speed FASP large-file transfer", url: "https://www.ibm.com/products/aspera" },
  { name: "Signiant", type: "Storage/transfer", region: "Global", city: "Boston", blurb: "Media Shuttle fast secure file transfer", url: "https://www.signiant.com" },
  { name: "MASV", type: "Storage/transfer", region: "Global", city: "Ottawa", blurb: "Fast large-file transfer for media", url: "https://massive.io" },
  { name: "LucidLink", type: "Storage/transfer", region: "Global", city: "San Mateo", blurb: "Cloud file streaming for creative teams", url: "https://www.lucidlink.com" },
  { name: "Resilio", type: "Storage/transfer", region: "Global", city: "San Francisco", blurb: "P2P file sync and fast transfer", url: "https://www.resilio.com" },
  { name: "Backblaze", type: "Storage/transfer", region: "Global", city: "San Mateo", blurb: "Cloud backup and B2 object storage", url: "https://www.backblaze.com" },
  { name: "OWC", type: "Storage/transfer", region: "Global", city: "Woodstock", blurb: "Storage, RAID and docks for creatives", url: "https://www.owc.com" },
  { name: "SanDisk Professional", type: "Storage/transfer", region: "Global", city: "San Jose", blurb: "G-Drive and PRO-BLADE pro storage (ex-G-Tech)", url: "https://www.westerndigital.com/brand/sandisk-professional" },

  // ---- Global film labs ----
  { name: "Kodak", type: "Film lab", region: "Global", city: "Rochester", blurb: "Motion picture film stock and processing", url: "https://www.kodak.com/en/motion" },
  { name: "FotoKem", type: "Film lab", region: "Global", city: "Burbank", blurb: "Full-service film lab and post", url: "https://fotokem.com" },
  { name: "Cinelab (US)", type: "Film lab", region: "Global", city: "New Bedford", blurb: "8/16/35mm processing, scanning, film-out", url: "https://www.cinelab.com" },

  // ---- Global DCP / QC / finishing ----
  { name: "Company 3", type: "Colour", region: "Global", city: "Los Angeles", blurb: "Leading global colour and finishing", url: "https://www.company3.com" },
  { name: "Deluxe", type: "DCP/QC", region: "Global", city: "Los Angeles", blurb: "Global post, localization and distribution", url: "https://www.bydeluxe.com" },
  { name: "Visual Data Media Services", type: "DCP/QC", region: "Global", city: "Burbank", blurb: "Media supply chain, QC, localization", url: "https://www.visualdatamedia.com" },
  { name: "Pixelogic", type: "DCP/QC", region: "Global", city: "Burbank", blurb: "Localization, DCP mastering and distribution", url: "https://pixelogicmedia.com" },
  { name: "Iyuno", type: "DCP/QC", region: "Global", city: "Burbank", blurb: "World's largest media localization company", url: "https://iyuno.com" },
  { name: "EIKON Group", type: "DCP/QC", region: "Global", city: "London", blurb: "Content mastering, QC and localization", url: "https://eikon.group" },
  { name: "Roundabout Entertainment", type: "DCP/QC", region: "Global", city: "Burbank", blurb: "Mastering, restoration, audio and DCP", url: "https://www.roundabout.com" },
];
