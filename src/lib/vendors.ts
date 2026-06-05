// Vendor directory — post-production facilities, film labs, VFX, audio, DCP/QC,
// camera rental, plus the global software/hardware the post world runs on.
// Sourced from the NZ Post-Super Master Reference (NZ) + web research (AU, UK,
// France, Germany, Singapore, global), each verified as currently operating at
// time of research. Companies change fast — confirm current status before relying on it.

export type VendorType =
  | "Post facility" | "Colour" | "VFX" | "Animation" | "Audio" | "DIT/Dailies"
  | "Film lab" | "DCP/QC" | "Captions" | "Studio" | "Camera rental"
  | "Software" | "Hardware" | "Storage/transfer";

export type VendorRegion = "AU" | "NZ" | "UK" | "France" | "Germany" | "Singapore" | "US" | "Global";

export interface Vendor {
  name: string;
  types: VendorType[];
  region: VendorRegion;
  city?: string;
  blurb: string;
  url: string;
}

export const VENDOR_TYPES: VendorType[] = [
  "Post facility", "Colour", "VFX", "Animation", "Audio", "DIT/Dailies", "Film lab", "DCP/QC", "Captions", "Studio", "Camera rental", "Software", "Hardware", "Storage/transfer",
];

export const VENDOR_REGIONS: VendorRegion[] = ["AU", "NZ", "UK", "France", "Germany", "Singapore", "US", "Global"];

export const VENDOR_REGION_LABEL: Record<VendorRegion, string> = {
  AU: "Australia", NZ: "New Zealand", UK: "United Kingdom", France: "France",
  Germany: "Germany", Singapore: "Singapore", US: "United States", Global: "Global",
};

export const VENDOR_TYPE_COLOR: Record<VendorType, string> = {
  "Post facility": "#22d3ee",
  "Colour": "#a78bfa",
  "VFX": "#2dd4bf",
  "Animation": "#c084fc",
  "Audio": "#38bdf8",
  "DIT/Dailies": "#34d399",
  "Film lab": "#f59e0b",
  "DCP/QC": "#fb7185",
  "Captions": "#f472b6",
  "Studio": "#fcd34d",
  "Camera rental": "#4ade80",
  "Software": "#818cf8",
  "Hardware": "#94a3b8",
  "Storage/transfer": "#fbbf24",
};

export const VENDORS: Vendor[] = [
  // ---- New Zealand ----
  { name: "Park Road Post", types: ["Post facility", "Colour", "Audio", "DIT/Dailies", "Film lab", "DCP/QC", "Studio"], region: "NZ", city: "Wellington", blurb: "Premier feature finishing — sound, DI, film lab, DCP", url: "https://www.parkroad.co.nz" },
  { name: "Department of Post", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "NZ", city: "Auckland", blurb: "End-to-end editorial, picture finishing and audio", url: "https://www.departmentofpost.com" },
  { name: "Images & Sound", types: ["Post facility", "Colour", "VFX", "Animation", "Audio", "DIT/Dailies"], region: "NZ", city: "Auckland", blurb: "Complete post: grade, VFX, Atmos sound, ADR", url: "https://www.imagesandsound.co.nz" },
  { name: "Pinnacle Post", types: ["Post facility", "Colour", "Audio", "VFX"], region: "NZ", city: "Auckland", blurb: "Boutique sound and picture for film/episodic", url: "https://www.pinnaclepost.co.nz" },
  { name: "Toybox", types: ["Post facility", "VFX", "Animation", "Colour"], region: "NZ", city: "Auckland", blurb: "VFX, animation and post for screen", url: "https://www.toybox.co.nz" },
  { name: "POW Studios", types: ["Post facility", "VFX", "Colour", "Animation"], region: "NZ", city: "Wellington", blurb: "VFX, picture post, grading, projection", url: "https://powpost.co.nz" },
  { name: "Envy Studios", types: ["Audio", "Post facility", "Colour", "VFX"], region: "NZ", city: "Auckland", blurb: "Boutique audio and video post house", url: "https://envystudios.co.nz" },
  { name: "The Finishing Suite", types: ["Post facility", "Colour"], region: "NZ", city: "Auckland", blurb: "Boutique online editing and colour grading", url: "https://www.thefinishingsuite.co.nz" },
  { name: "The Sugarworks", types: ["Post facility", "Colour", "DIT/Dailies", "DCP/QC"], region: "NZ", city: "Auckland", blurb: "Boutique editing, grade, DIT, DCP outputs", url: "https://www.sugarworks.co.nz" },
  { name: "Colour Space", types: ["Colour", "VFX"], region: "NZ", city: "Auckland", blurb: "Boutique colour grading and finishing house", url: "https://www.colourspace.tv" },
  { name: "Wētā FX", types: ["VFX", "Animation"], region: "NZ", city: "Wellington", blurb: "World-leading feature VFX and digital characters", url: "https://www.wetafx.co.nz" },
  { name: "Wētā Workshop", types: ["VFX", "Studio"], region: "NZ", city: "Wellington", blurb: "Physical effects, props, prosthetics, concept design", url: "https://www.wetaworkshop.com" },
  { name: "Cause and FX", types: ["VFX"], region: "NZ", city: "Auckland", blurb: "Independent feature and TV visual effects house", url: "https://causeandfx.nz" },
  { name: "Blockhead", types: ["VFX"], region: "NZ", city: "Auckland", blurb: "Boutique VFX for film, ads, augmented reality", url: "https://www.blockheadvfx.com" },
  { name: "PRPVFX", types: ["VFX"], region: "NZ", city: "Auckland", blurb: "Award-winning feature and TV visual effects", url: "https://www.prpvfx.com" },
  { name: "Albedo VFX", types: ["VFX"], region: "NZ", city: "Auckland", blurb: "Matte paintings, 3D environments, virtual sets", url: "https://albedovfx.com" },
  { name: "Assembly", types: ["VFX", "Animation"], region: "NZ", city: "Auckland", blurb: "VFX, 3D, animation and design studio", url: "https://www.assemblyltd.com" },
  { name: "OHUfx", types: ["VFX"], region: "NZ", city: "Wellington", blurb: "Boutique VFX and compositing for features", url: "https://www.ohufx.com" },
  { name: "808 Ltd", types: ["VFX"], region: "NZ", city: "Wellington", blurb: "Boutique compositing-led VFX studio", url: "https://www.808ltd.co.nz" },
  { name: "Cirkus", types: ["Animation"], region: "NZ", city: "Auckland", blurb: "Award-winning Auckland animation studio", url: "https://www.cirkus.nz" },
  { name: "Flux Animation Studio", types: ["Animation"], region: "NZ", city: "Auckland", blurb: "Character animation for ads, film, TV", url: "https://fluxmedia.co.nz" },
  { name: "Yukfoo Animation", types: ["Animation"], region: "NZ", city: "Auckland", blurb: "Emmy-nominated 2D and 3D animation studio", url: "https://www.yukfoo.net" },
  { name: "Mukpuddy Animation", types: ["Animation"], region: "NZ", city: "Auckland", blurb: "Full-service 2D animation studio", url: "https://mukpuddy.com" },
  { name: "Post Production Sound", types: ["Audio"], region: "NZ", city: "Auckland", blurb: "Boutique Pro Tools sound mix, Atmos-ready", url: "http://postproductionsound.co.nz" },
  { name: "Native Audio", types: ["Audio"], region: "NZ", city: "Wellington", blurb: "Sound design and audio post for film", url: "https://www.nativeaudio.co.nz" },
  { name: "Undergroundsound", types: ["Audio"], region: "NZ", city: "Wellington", blurb: "Audio post, foley, ADR, mixing", url: "https://www.undergroundsound.co.nz" },
  { name: "Matrix Digital", types: ["Audio"], region: "NZ", city: "Wellington", blurb: "ADR, foley, sound design, mixing studio", url: "https://www.matrixdigital.co.nz" },
  { name: "Liquid Studios", types: ["Audio"], region: "NZ", city: "Auckland", blurb: "Audio post and music composition studio", url: "https://www.liquidstudios.co.nz" },
  { name: "Bespoke Post", types: ["Audio"], region: "NZ", city: "Kerikeri", blurb: "Emmy-nominated foley, sound design, mixing", url: "https://www.bespokepost.nz" },
  { name: "Franklin Rd Music & Sound", types: ["Audio"], region: "NZ", city: "Auckland", blurb: "Audio post, ADR, foley, music composition", url: "https://www.franklinrd.co.nz" },
  { name: "Bigpop Studios", types: ["Audio"], region: "NZ", city: "Auckland", blurb: "Music recording and sound post studio", url: "https://www.bigpopstudios.com" },
  { name: "Nektar", types: ["DIT/Dailies"], region: "NZ", city: "Wellington", blurb: "DIT and dailies, video playback systems", url: "https://nektar.co.nz" },
  { name: "The Rebel Fleet", types: ["DIT/Dailies", "Post facility"], region: "NZ", city: "Auckland", blurb: "Video assist, DIT and dailies services", url: "https://www.rebelfleet.co.nz" },
  { name: "Halcyon Digital", types: ["DIT/Dailies"], region: "NZ", city: "Auckland", blurb: "DIT, data management and QTake video playback", url: "https://halcyon.digital" },
  { name: "DVANZ", types: ["DIT/Dailies", "Camera rental"], region: "NZ", city: "Auckland", blurb: "Video assist, DIT and on-set data management", url: "https://www.dvanz.co.nz" },
  { name: "Philmhaus", types: ["DCP/QC"], region: "NZ", city: "Wellington", blurb: "Digital cinema package creation and QC", url: "https://www.philmhaus.com" },
  { name: "Able", types: ["Captions"], region: "NZ", city: "Auckland", blurb: "NZ's leading captioning and subtitling service", url: "https://able.co.nz" },
  { name: "Portsmouth", types: ["Camera rental"], region: "NZ", city: "Wellington", blurb: "Camera, lighting and grip equipment rental", url: "https://portsmouth.co.nz" },
  { name: "Metro Film", types: ["Camera rental"], region: "NZ", city: "Auckland", blurb: "Cinema camera and lens rental house", url: "https://metrofilm.co.nz" },
  { name: "Imagezone", types: ["Camera rental"], region: "NZ", city: "Auckland", blurb: "Cinematographer support and camera rental", url: "https://www.imagezone.co.nz" },
  { name: "Panavision Auckland", types: ["Camera rental"], region: "NZ", city: "Auckland", blurb: "Film and digital cinema camera rental", url: "https://www.panavision.com" },
  { name: "Stone Street Studios", types: ["Studio"], region: "NZ", city: "Wellington", blurb: "Major purpose-built film soundstages (Wētā)", url: "https://www.stonestreetstudios.co.nz" },
  { name: "Avalon Studios", types: ["Studio"], region: "NZ", city: "Wellington", blurb: "Four stages, backlot, production offices", url: "https://avalonstudios.co.nz" },
  { name: "Lane Street Studios", types: ["Studio"], region: "NZ", city: "Wellington", blurb: "Two large purpose-built soundstages", url: "https://www.lanestreetstudios.com" },
  { name: "Auckland Film Studios", types: ["Studio"], region: "NZ", city: "Auckland", blurb: "Five sound stages in West Auckland", url: "https://www.aucklandfilmstudios.com" },
  { name: "Studio West", types: ["Studio"], region: "NZ", city: "Auckland", blurb: "Sound stages and workshops, West Auckland", url: "https://www.studiowest.co.nz" },
  { name: "X3 Studios", types: ["Studio"], region: "NZ", city: "Auckland", blurb: "Largest clear-span stage, Southern Hemisphere", url: "https://x3studios.co.nz" },
  { name: "Kumeu Film Studios", types: ["Studio"], region: "NZ", city: "Auckland", blurb: "Stages plus ocean and dive tanks", url: "https://www.kumeufilmstudios.co.nz" },
  { name: "Koawa Studios", types: ["Studio", "Audio"], region: "NZ", city: "Christchurch", blurb: "Virtual production, green screen, sound stages", url: "https://koawa.co.nz" },

  // ---- Australia ----
  { name: "Spectrum Films", types: ["Post facility", "Colour", "VFX", "Audio", "DCP/QC"], region: "AU", city: "Sydney", blurb: "Picture, sound and VFX; family-run since 1964", url: "https://spectrumfilms.com.au" },
  { name: "Cutting Edge", types: ["Post facility", "DIT/Dailies", "VFX", "Colour", "Audio"], region: "AU", city: "Brisbane", blurb: "Full-service post with dailies and DIT", url: "https://www.cuttingedge.com.au" },
  { name: "KOJO", types: ["Post facility", "DIT/Dailies", "VFX", "Colour"], region: "AU", city: "Adelaide", blurb: "Lens-to-screen post, data management and DI", url: "https://kojo.co" },
  { name: "The Post Lounge", types: ["Post facility", "DIT/Dailies", "Colour", "VFX", "Audio"], region: "AU", city: "Sydney", blurb: "Near-set and in-facility dailies, data services", url: "https://www.thepostlounge.com" },
  { name: "ZIGZAG Post", types: ["Post facility", "DIT/Dailies", "Colour", "Audio", "DCP/QC"], region: "AU", city: "Sydney", blurb: "Dailies processing, colour grade and mastering", url: "https://www.zigzagpost.com" },
  { name: "Eden Studios", types: ["Colour"], region: "AU", city: "Sydney", blurb: "Dolby Vision / Atmos grade and finish facility", url: "https://edenstudios.com.au" },
  { name: "Rising Sun Pictures", types: ["VFX"], region: "AU", city: "Adelaide", blurb: "Hollywood feature VFX; Adelaide and Brisbane", url: "https://rsp.com.au" },
  { name: "FIN Design + Effects", types: ["VFX"], region: "AU", city: "Sydney", blurb: "VFX and design; Sydney, Melbourne, Gold Coast", url: "https://www.findesign.com.au" },
  { name: "Alt.VFX", types: ["VFX"], region: "AU", city: "Brisbane", blurb: "VFX and virtual production", url: "https://www.altvfx.com" },
  { name: "Luma Pictures", types: ["VFX"], region: "AU", city: "Melbourne", blurb: "Independent feature-film visual effects studio", url: "https://www.lumapictures.com" },
  { name: "Framestore Melbourne", types: ["VFX"], region: "AU", city: "Melbourne", blurb: "High-end feature VFX (formerly Method Studios)", url: "https://www.framestore.com" },
  { name: "Heckler", types: ["VFX"], region: "AU", city: "Sydney", blurb: "VFX, CGI, design, animation, edit and colour", url: "https://heckler.tv" },
  { name: "Soundfirm", types: ["Audio"], region: "AU", city: "Melbourne", blurb: "Sound mix, ADR, Atmos; Melbourne and Sydney", url: "https://www.soundfirm.com" },
  { name: "Trackdown", types: ["Audio"], region: "AU", city: "Sydney", blurb: "Scoring stage, ADR, Foley, sound post", url: "https://trackdown.com.au" },
  { name: "ROAR Digital", types: ["Film lab"], region: "AU", city: "Melbourne", blurb: "Film scanning, grading, restoration and mastering", url: "https://roardigital.com.au" },
  { name: "Nano Lab", types: ["Film lab"], region: "AU", city: "Daylesford", blurb: "Super 8 motion-picture film processing and supply", url: "https://nanolab.com.au" },
  { name: "Rewind Photo Lab", types: ["Film lab"], region: "AU", city: "Sydney", blurb: "Super 8 and 16mm ECN-2 processing and scanning", url: "https://rewindphotolab.com.au" },
  { name: "FATS", types: ["DCP/QC"], region: "AU", city: "Sydney", blurb: "DCP mastering, QC, deliverables and distribution", url: "https://fats.com.au" },
  { name: "The Finishing Room", types: ["DCP/QC"], region: "AU", city: "Sydney", blurb: "DCP mastering and Dolby-tested cinema deliverables", url: "https://www.finishingroom.com.au" },
  { name: "Unravel", types: ["DCP/QC"], region: "AU", city: "Melbourne", blurb: "Cinema-ready DCP mastering for films and trailers", url: "https://www.unravel.com.au" },
  { name: "Post Lab", types: ["DCP/QC"], region: "AU", city: "Melbourne", blurb: "2K/4K DCP creation and worldwide distribution", url: "https://www.postlab.io" },
  { name: "Panavision Australia", types: ["Camera rental"], region: "AU", city: "Sydney", blurb: "Cinema camera, lens, grip and lighting rental", url: "https://www.panavision.com.au" },
  { name: "Lemac", types: ["Camera rental"], region: "AU", city: "Melbourne", blurb: "Camera and digital cinema rental", url: "https://www.lemac.com.au" },

  // ---- United Kingdom ----
  { name: "Goldcrest Post", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "Film lab", "DCP/QC"], region: "UK", city: "London", blurb: "Feature/TV picture and sound finishing, Soho", url: "https://goldcrestfilms.com/post-production" },
  { name: "Molinare", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "UK", city: "London", blurb: "Soho picture, sound, VFX, DI", url: "https://molinare.co.uk" },
  { name: "Envy Post Production", types: ["Post facility", "Colour", "VFX", "Animation", "Audio"], region: "UK", city: "London", blurb: "Online, grading, audio — Fitzrovia post house", url: "https://www.envypost.co.uk" },
  { name: "The Farm", types: ["Post facility", "Colour", "VFX", "Audio"], region: "UK", city: "London", blurb: "Picture and sound post; Soho and Cardiff", url: "https://farmgroup.tv" },
  { name: "Halo Post Production", types: ["Post facility", "Colour", "Audio", "DIT/Dailies", "DCP/QC"], region: "UK", city: "London", blurb: "Grading, online, sound — Soho post", url: "https://www.halopost.com" },
  { name: "OnSight", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "UK", city: "London", blurb: "Dailies, picture post, VFX, sound", url: "https://onsight.co.uk" },
  { name: "Picture Shop", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "Studio"], region: "UK", city: "London", blurb: "Editorial, colour, sound, VFX, dailies", url: "https://www.pictureshop.com" },
  { name: "Films at 59", types: ["Post facility", "Colour", "Audio", "DIT/Dailies"], region: "UK", city: "Bristol", blurb: "Picture/sound post and equipment hire", url: "https://filmsat59.com" },
  { name: "Twickenham Film Studios", types: ["Post facility"], region: "UK", city: "London", blurb: "Sound dubbing, ADR, cutting rooms", url: "https://www.twickenhamstudios.com" },
  { name: "Company 3 London", types: ["Colour", "DIT/Dailies"], region: "UK", city: "London", blurb: "Feature/episodic colour grading, Chancery Lane", url: "https://www.company3.com/locations/london" },
  { name: "Mission Digital", types: ["DIT/Dailies", "Colour"], region: "UK", city: "Shepperton", blurb: "HDR grading, dailies and DIT services", url: "https://www.missiondigital.co.uk" },
  { name: "HIJACK Post Production", types: ["DIT/Dailies", "Post facility", "DCP/QC"], region: "UK", city: "London", blurb: "On-set DIT, data management and digital dailies", url: "https://hijackpost.com" },
  { name: "Notorious DIT", types: ["DIT/Dailies"], region: "UK", city: "London", blurb: "On-set DIT, data management and dailies lab", url: "https://notorious-dit.co.uk" },
  { name: "Digital Orchard Group", types: ["DIT/Dailies", "Film lab"], region: "UK", city: "Chalfont St Giles", blurb: "DITs, data managers, dailies and film scanning", url: "https://digitalorchardgroup.com" },
  { name: "Pixel and Process", types: ["DIT/Dailies"], region: "UK", city: "Cardiff", blurb: "Digital dailies, DIT and camera-to-post workflow", url: "https://pixelandprocess.co.uk" },
  { name: "Coffee & TV", types: ["Colour"], region: "UK", city: "London", blurb: "Colour, VFX and finishing for film/TV", url: "https://coffeeand.tv" },
  { name: "Framestore", types: ["VFX"], region: "UK", city: "London", blurb: "Oscar-winning feature and episodic VFX", url: "https://www.framestore.com" },
  { name: "DNEG", types: ["VFX"], region: "UK", city: "London", blurb: "Academy Award-winning VFX, Fitzrovia", url: "https://www.dneg.com" },
  { name: "Cinesite", types: ["VFX"], region: "UK", city: "London", blurb: "Feature VFX and animation studio", url: "https://cinesite.com" },
  { name: "MPC", types: ["VFX"], region: "UK", city: "London", blurb: "Blockbuster VFX and animation, Soho", url: "https://www.moving-picture.com" },
  { name: "ILM London", types: ["VFX"], region: "UK", city: "London", blurb: "Lucasfilm feature and episodic VFX", url: "https://www.ilm.com/locations/london" },
  { name: "Milk VFX", types: ["VFX"], region: "UK", city: "London", blurb: "Episodic and feature VFX, Clerkenwell", url: "https://www.milk-vfx.com" },
  { name: "Union VFX", types: ["VFX"], region: "UK", city: "London", blurb: "Invisible effects and CG environments, Soho", url: "https://www.unionvfx.com" },
  { name: "Outpost VFX", types: ["VFX"], region: "UK", city: "Bournemouth", blurb: "Environments, creatures and digital makeup VFX", url: "https://www.outpost-vfx.com" },
  { name: "Warner Bros De Lane Lea", types: ["Audio"], region: "UK", city: "London", blurb: "Sound and picture post, Soho", url: "https://www.wbsl.com/de-lane-lea" },
  { name: "Hackenbacker", types: ["Audio"], region: "UK", city: "London", blurb: "Sound design, ADR, foley, mixing", url: "https://www.hackenbacker.com" },
  { name: "Boom Post", types: ["Audio"], region: "UK", city: "London", blurb: "Sound editing, foley, ADR, mixing", url: "https://www.boompost.co.uk" },
  { name: "Cinelab Film & Digital", types: ["Film lab"], region: "UK", city: "Slough", blurb: "16/35/65mm processing, scanning, restoration", url: "https://www.cinelab.co.uk" },
  { name: "Kodak Film Lab London", types: ["Film lab"], region: "UK", city: "Iver Heath", blurb: "Motion picture processing and scanning, Pinewood", url: "https://www.kodak.com/en/motion/page/kodak-film-labs" },
  { name: "Dragon Digital Intermediate", types: ["Film lab"], region: "UK", city: "Bridgend", blurb: "Film scanning, restoration, DI, DCP mastering", url: "https://dragondi.co.uk" },
  { name: "R3store Studios", types: ["Film lab"], region: "UK", city: "London", blurb: "Film restoration, scanning, grading, telecine", url: "https://r3storestudios.com" },
  { name: "Deluxe London", types: ["DCP/QC"], region: "UK", city: "London", blurb: "DCP mastering, QC, cinema distribution", url: "https://www.bydeluxe.com" },
  { name: "ARRI Rental UK", types: ["Camera rental"], region: "UK", city: "Uxbridge", blurb: "Camera, lighting and grip rental", url: "https://www.arrirental.co.uk" },
  { name: "Panavision UK", types: ["Camera rental"], region: "UK", city: "Greenford", blurb: "Cinema camera, lens and grip rental", url: "https://uk.panavision.com" },
  { name: "Movietech Camera Rentals", types: ["Camera rental"], region: "UK", city: "Iver Heath", blurb: "Camera and grip rental, Pinewood", url: "https://www.movietech.co.uk" },
  { name: "Procam Take 2", types: ["Camera rental"], region: "UK", city: "London", blurb: "Digital cinematography camera and kit hire", url: "https://procamtake2.com" },

  // ---- France ----
  { name: "Eclair", types: ["Post facility", "Colour", "VFX", "Audio", "Film lab", "DCP/QC"], region: "France", city: "Vanves", blurb: "Post, restoration, DCP mastering, versioning, delivery", url: "https://eclair.digital" },
  { name: "Hiventy (TransPerfect)", types: ["DCP/QC"], region: "France", city: "Joinville-le-Pont", blurb: "Localization, dubbing, subtitling, restoration, DCP", url: "https://www.hiventy.com" },
  { name: "Le Labo Paris", types: ["Post facility", "Colour", "VFX", "DIT/Dailies"], region: "France", city: "Paris", blurb: "Boutique finishing — conform, grading, VFX", url: "http://lelabo.paris" },
  { name: "Cosmodigital", types: ["Post facility", "Colour", "VFX", "DIT/Dailies", "Film lab", "DCP/QC"], region: "France", city: "Paris", blurb: "Film and digital post, shoot to delivery", url: "https://www.cosmo-digital.com" },
  { name: "M141", types: ["Colour"], region: "France", city: "Paris", blurb: "Feature-film grading house (Titane, Palme d'Or)", url: "http://www.m141.fr" },
  { name: "MPC Paris", types: ["VFX"], region: "France", city: "Paris", blurb: "High-end VFX for features and series (ex-Mikros)", url: "https://www.mpcvfx.com" },
  { name: "Mac Guff", types: ["VFX"], region: "France", city: "Paris", blurb: "Veteran Paris VFX and animation studio", url: "https://macguff.com" },
  { name: "BUF", types: ["VFX"], region: "France", city: "Paris", blurb: "Pioneering French CGI and visual effects house", url: "https://buf.com" },
  { name: "Digital District", types: ["VFX"], region: "France", city: "Paris", blurb: "VFX, post-production and colour grading", url: "https://www.digital-district.fr" },
  { name: "L'Image Retrouvée", types: ["Film lab"], region: "France", city: "Paris", blurb: "Film restoration, scanning, 4K grading", url: "https://imageretrouvee.fr" },
  { name: "Poly Son", types: ["Audio"], region: "France", city: "Paris", blurb: "Picture and sound post, Dolby Atmos mixing", url: "https://polyson.fr" },
  { name: "Piste Rouge", types: ["Audio"], region: "France", city: "Paris", blurb: "Sound design, music, Dolby Atmos mixing", url: "https://pisterouge.com" },
  { name: "Dubbing Brothers", types: ["Audio"], region: "France", city: "Saint-Denis", blurb: "French-language dubbing for film and TV", url: "https://www.dubbing-brothers.com" },
  { name: "RVZ", types: ["Camera rental"], region: "France", city: "Ivry-sur-Seine", blurb: "Camera, lens and lighting rental, Paris", url: "https://rvz-location.fr" },
  { name: "TSF", types: ["Camera rental"], region: "France", city: "Paris", blurb: "Camera, grip, lighting, studios and backlots", url: "https://groupe-tsf.com" },
  { name: "Transpacam", types: ["Camera rental"], region: "France", city: "Gennevilliers", blurb: "Camera and lens rental for film, TV", url: "https://www.transpacam.com" },
  { name: "Be4Post", types: ["DIT/Dailies", "Hardware", "Storage/transfer"], region: "France", city: "Paris", blurb: "DIT stations, dailies prep and data management", url: "https://www.be4post.com" },

  // ---- Germany ----
  { name: "Cine Plus", types: ["Post facility", "Colour", "VFX", "Animation", "Audio", "DCP/QC", "Camera rental", "Studio"], region: "Germany", city: "Berlin", blurb: "Full-service production, post and rental", url: "https://www.cine-plus.de" },
  { name: "The Post Republic", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies"], region: "Germany", city: "Berlin", blurb: "DI, grading, VFX, sound for international productions", url: "https://post-republic.com" },
  { name: "PHAROS (ex-ARRI Media)", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "Germany", city: "Munich", blurb: "Germany's largest post house; VFX, grade, mastering", url: "https://www.pharos.de" },
  { name: "CinePostproduction", types: ["Post facility", "Colour", "Audio", "DIT/Dailies", "Film lab", "DCP/QC"], region: "Germany", city: "Unterföhring", blurb: "Film processing, dailies, grading, DCP, sound", url: "https://cinepostproduction.de" },
  { name: "Trixter", types: ["VFX"], region: "Germany", city: "Munich", blurb: "High-end VFX and animation (Marvel features)", url: "https://www.trixter.de" },
  { name: "RISE Visual Effects", types: ["VFX"], region: "Germany", city: "Berlin", blurb: "Major central-European VFX studio", url: "https://www.risefx.com" },
  { name: "Scanline VFX (Eyeline)", types: ["VFX"], region: "Germany", city: "Munich", blurb: "Award-winning VFX, founded in Munich", url: "https://www.scanlinevfx.com" },
  { name: "Pixomondo", types: ["VFX"], region: "Germany", city: "Frankfurt", blurb: "Emmy-winning VFX and virtual production", url: "https://pixomondo.com" },
  { name: "Optical Art", types: ["VFX"], region: "Germany", city: "Hamburg", blurb: "VFX and post for cinema and TV", url: "https://www.opticalart.de" },
  { name: "Andec Filmtechnik", types: ["Film lab"], region: "Germany", city: "Berlin", blurb: "Photochemical lab; 16/35mm processing, scanning", url: "https://andecfilm.de" },
  { name: "Rotor Film", types: ["Audio"], region: "Germany", city: "Potsdam", blurb: "Sound post; one of Europe's largest Atmos stages", url: "https://rotor-film.com" },
  { name: "toneworx", types: ["Audio"], region: "Germany", city: "Hamburg", blurb: "Dubbing, sound design, Dolby Atmos mix", url: "https://www.toneworx.com" },
  { name: "DCP Manufaktur", types: ["DCP/QC"], region: "Germany", city: "Berlin", blurb: "Specialist DCP encoding and mastering", url: "https://dcpmanufaktur.com" },
  { name: "ARRI Rental", types: ["Camera rental"], region: "Germany", city: "Ismaning", blurb: "Camera, lighting and grip rental across Europe", url: "https://www.arrirental.com" },
  { name: "Ludwig Kameraverleih", types: ["Camera rental"], region: "Germany", city: "Munich", blurb: "Leading German camera rental, Panavision partner", url: "https://ludwigkamera.de" },
  { name: "FGV Schmidle", types: ["Camera rental"], region: "Germany", city: "Munich", blurb: "Camera, lighting and grip rental house", url: "https://fgv-rental.de" },

  // ---- Singapore ----
  { name: "Infinite Studios", types: ["Post facility", "VFX", "Animation", "Studio"], region: "Singapore", city: "Singapore", blurb: "Soundstages, post, VFX and animation hub", url: "https://www.infinitestudios.com.sg" },
  { name: "Nine-V Post Production", types: ["Post facility"], region: "Singapore", city: "Singapore", blurb: "Edit, grade, DCP, QC, Dolby Vision", url: "https://www.nine-v.com" },
  { name: "Mark Song Grades", types: ["Colour"], region: "Singapore", city: "Singapore", blurb: "Dolby Vision-certified senior feature colourist", url: "https://marksonggrades.com" },
  { name: "VHQ Media", types: ["VFX"], region: "Singapore", city: "Singapore", blurb: "One of Asia's largest VFX/post houses", url: "https://www.vhqmedia.com" },
  { name: "Vividthree Productions", types: ["VFX"], region: "Singapore", city: "Singapore", blurb: "VFX, CG animation and immersive content", url: "https://www.vividthree.com" },
  { name: "One Animation", types: ["VFX"], region: "Singapore", city: "Singapore", blurb: "CG animation studio behind Oddbods", url: "https://www.oneanimation.com" },
  { name: "Yellow Box Studios", types: ["Audio"], region: "Singapore", city: "Singapore", blurb: "Top Singapore sound post and music studio", url: "http://www.yellowboxstudios.com" },
  { name: "Doppler Soundlab", types: ["Audio"], region: "Singapore", city: "Singapore", blurb: "Dolby Atmos audio post for film/TV", url: "https://doppler.sg" },
  { name: "Mocha Chai Laboratories", types: ["DCP/QC"], region: "Singapore", city: "Singapore", blurb: "Boutique film lab; DCP, QC, Dolby Vision/Atmos", url: "https://mochachailab.com" },
  { name: "Camwerkz", types: ["Camera rental"], region: "Singapore", city: "Singapore", blurb: "Singapore's main cinema camera rental hub", url: "https://camwerkz.com" },

  // ---- Global software ----
  { name: "Blackmagic Design", types: ["Software"], region: "Global", city: "Melbourne", blurb: "DaVinci Resolve — edit, grade, VFX, deliver", url: "https://www.blackmagicdesign.com" },
  { name: "Avid", types: ["Software"], region: "Global", city: "Burlington", blurb: "Media Composer editing and production tools", url: "https://www.avid.com" },
  { name: "Adobe", types: ["Software"], region: "Global", city: "San Jose", blurb: "Premiere Pro and Frame.io review workflow", url: "https://www.adobe.com" },
  { name: "Autodesk", types: ["Software"], region: "Global", city: "San Francisco", blurb: "Flame finishing and Flow production tracking", url: "https://www.autodesk.com" },
  { name: "FilmLight", types: ["Software"], region: "Global", city: "London", blurb: "Baselight colour grading and finishing systems", url: "https://www.filmlight.ltd.uk" },
  { name: "Foundry", types: ["Software"], region: "Global", city: "London", blurb: "Nuke node-based compositing and VFX", url: "https://www.foundry.com" },
  { name: "Colorfront", types: ["Software"], region: "Global", city: "Budapest", blurb: "Transkoder mastering, dailies and QC tools", url: "https://colorfront.com" },
  { name: "Pomfort", types: ["Software"], region: "Global", city: "Munich", blurb: "Silverstack on-set data management software", url: "https://pomfort.com" },
  { name: "Assimilate", types: ["Software"], region: "Global", city: "Pittsburgh", blurb: "Scratch dailies, grading and finishing", url: "https://www.assimilateinc.com" },
  { name: "Colourlab AI", types: ["Software"], region: "Global", city: "New York", blurb: "AI-assisted colour grading and matching", url: "https://colourlab.ai" },
  { name: "Telestream", types: ["Software"], region: "Global", city: "Nevada City", blurb: "Vantage media processing, transcode and QC", url: "https://www.telestream.com" },

  // ---- Global hardware ----
  { name: "ARRI", types: ["Hardware"], region: "Global", city: "Munich", blurb: "Alexa cinema cameras, lenses and lighting", url: "https://www.arri.com" },
  { name: "RED Digital Cinema", types: ["Hardware"], region: "Global", city: "Foothill Ranch", blurb: "High-resolution digital cinema cameras", url: "https://www.red.com" },
  { name: "Sony Cinema", types: ["Hardware"], region: "Global", city: "Tokyo", blurb: "VENICE and CineAlta digital cinema cameras", url: "https://pro.sony" },
  { name: "Codex", types: ["Hardware"], region: "Global", city: "London", blurb: "High-end camera recording media and workflow", url: "https://codex.online" },
  { name: "AJA Video Systems", types: ["Hardware"], region: "Global", city: "Grass Valley", blurb: "Video I/O, conversion and Ki Pro recorders", url: "https://www.aja.com" },
  { name: "Atomos", types: ["Hardware"], region: "Global", city: "Melbourne", blurb: "Ninja and Shogun monitor-recorders", url: "https://www.atomos.com" },
  { name: "Teradek", types: ["Hardware"], region: "Global", city: "Irvine", blurb: "Wireless video transmission and streaming", url: "https://teradek.com" },

  // ---- Global storage / transfer ----
  { name: "IBM Aspera", types: ["Storage/transfer"], region: "Global", city: "Armonk", blurb: "High-speed FASP large-file transfer", url: "https://www.ibm.com/products/aspera" },
  { name: "Signiant", types: ["Storage/transfer"], region: "Global", city: "Boston", blurb: "Media Shuttle fast secure file transfer", url: "https://www.signiant.com" },
  { name: "MASV", types: ["Storage/transfer"], region: "Global", city: "Ottawa", blurb: "Fast large-file transfer for media", url: "https://massive.io" },
  { name: "LucidLink", types: ["Storage/transfer"], region: "Global", city: "San Mateo", blurb: "Cloud file streaming for creative teams", url: "https://www.lucidlink.com" },
  { name: "Resilio", types: ["Storage/transfer"], region: "Global", city: "San Francisco", blurb: "P2P file sync and fast transfer", url: "https://www.resilio.com" },
  { name: "Backblaze", types: ["Storage/transfer"], region: "Global", city: "San Mateo", blurb: "Cloud backup and B2 object storage", url: "https://www.backblaze.com" },
  { name: "OWC", types: ["Storage/transfer"], region: "Global", city: "Woodstock", blurb: "Storage, RAID and docks for creatives", url: "https://www.owc.com" },
  { name: "SanDisk Professional", types: ["Storage/transfer"], region: "Global", city: "San Jose", blurb: "G-Drive and PRO-BLADE pro storage (ex-G-Tech)", url: "https://www.westerndigital.com/brand/sandisk-professional" },

  // ---- Global film labs ----
  { name: "Kodak", types: ["Film lab"], region: "Global", city: "Rochester", blurb: "Motion picture film stock and processing", url: "https://www.kodak.com/en/motion" },
  { name: "FotoKem", types: ["Film lab", "Colour", "DCP/QC", "DIT/Dailies"], region: "US", city: "Burbank", blurb: "Full-service film lab, post and finishing — LA", url: "https://fotokem.com" },
  { name: "Cinelab (US)", types: ["Film lab"], region: "US", city: "New Bedford", blurb: "8/16/35mm processing, scanning, film-out", url: "https://www.cinelab.com" },

  // ---- Global DCP / QC / finishing ----
  { name: "Company 3", types: ["Colour", "VFX", "DCP/QC", "DIT/Dailies"], region: "US", city: "Los Angeles", blurb: "Leading global colour and finishing", url: "https://www.company3.com" },
  { name: "Deluxe", types: ["DCP/QC", "Captions"], region: "US", city: "Los Angeles", blurb: "Global post, localization and distribution", url: "https://www.bydeluxe.com" },
  { name: "Visual Data Media Services", types: ["DCP/QC", "Captions"], region: "US", city: "Burbank", blurb: "Media supply chain, QC, localization", url: "https://www.visualdatamedia.com" },
  { name: "Pixelogic", types: ["DCP/QC", "Captions"], region: "US", city: "Burbank", blurb: "Localization, DCP mastering and distribution", url: "https://pixelogicmedia.com" },
  { name: "Iyuno", types: ["DCP/QC", "Captions"], region: "US", city: "Burbank", blurb: "World's largest media localization company", url: "https://iyuno.com" },
  { name: "EIKON Group", types: ["DCP/QC", "Captions"], region: "UK", city: "London", blurb: "Content mastering, QC and localization", url: "https://eikon.group" },
  { name: "Roundabout Entertainment", types: ["DCP/QC", "Audio", "DIT/Dailies"], region: "US", city: "Burbank", blurb: "Mastering, restoration, audio and DCP", url: "https://www.roundabout.com" },
  { name: "Light Iron", types: ["DIT/Dailies", "Colour", "Post facility"], region: "US", city: "Los Angeles", blurb: "In-facility, near-set and remote dailies, colour", url: "https://www.lightiron.com" },
  { name: "Pictureshop", types: ["DIT/Dailies", "Colour", "Post facility"], region: "US", city: "Los Angeles", blurb: "In-facility, near-set and remote dailies", url: "https://www.pictureshop.com" },
  { name: "Nice Shoes", types: ["DIT/Dailies", "Colour"], region: "US", city: "New York", blurb: "On-location, near-set and remote dailies, colour", url: "https://www.niceshoes.com" },
  { name: "Harbor", types: ["DIT/Dailies", "Colour", "Post facility"], region: "US", city: "New York", blurb: "Near-set and virtual-lab dailies, colour, finishing", url: "https://harborpicturecompany.com" },
  { name: "Goldcrest Post New York", types: ["DIT/Dailies", "Post facility", "Audio"], region: "US", city: "New York", blurb: "On-set dailies and feature/TV picture finishing", url: "https://www.goldcrestpostny.com" },

  // ---- Captions / transcripts ----
  { name: "Rev", types: ["Captions"], region: "US", city: "Austin", blurb: "Human/AI transcription, captions, subtitles", url: "https://www.rev.com" },
  { name: "3Play Media", types: ["Captions"], region: "US", city: "Boston", blurb: "Captions, subtitles, audio description, transcription", url: "https://www.3playmedia.com" },
  { name: "Verbit", types: ["Captions"], region: "US", city: "New York", blurb: "AI transcription, captions and subtitles", url: "https://verbit.ai" },
  { name: "CaptionHub", types: ["Captions"], region: "UK", city: "London", blurb: "AI captions and subtitles for video", url: "https://www.captionhub.com" },
  { name: "GoTranscript", types: ["Captions"], region: "US", city: "Lewes", blurb: "Human transcription, captions, subtitles", url: "https://gotranscript.com" },
  { name: "Happy Scribe", types: ["Captions"], region: "Global", city: "Barcelona", blurb: "Transcription and subtitles in 120+ languages", url: "https://www.happyscribe.com" },
  { name: "Amberscript", types: ["Captions"], region: "Global", city: "Amsterdam", blurb: "Transcription and subtitling, human and AI", url: "https://www.amberscript.com" },
  { name: "Otter.ai", types: ["Captions"], region: "US", city: "Mountain View", blurb: "AI transcription and live captions", url: "https://otter.ai" },
  { name: "CaptioningStar", types: ["Captions"], region: "US", city: "New York", blurb: "Closed captions, subtitles, video translation", url: "https://www.captioningstar.com" },
  { name: "Aberdeen Broadcast Services", types: ["Captions"], region: "US", city: "Rancho Santa Margarita", blurb: "Captions, subtitles, transcription for broadcast", url: "https://www.aberdeen.io" },
];
