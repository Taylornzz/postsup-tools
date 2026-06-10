// Vendor directory — post-production facilities, film labs, VFX, audio, DCP/QC,
// camera rental, plus the global software/hardware the post world runs on.
// Regions: NZ, AU, SE Asia, US, UK, France, Germany, Western Europe, Global.
//
// CURATION: every entry web-verified as currently operating, June 2026. The
// 2024–26 industry contraction is reflected — excluded as defunct/ceased:
// Technicolor Group + MPC (collapsed Feb 2025; brands to TransPerfect), Milk VFX
// (administration Oct 2024), Jellyfish Pictures (ceased Mar 2025), Pixomondo
// (Sony wind-down announced Mar 2026), Glassworks (closed Aug 2025), Windmill
// Lane (closed Jan 2025), Éclair (liquidation closed Jan 2025), One Animation
// (shut Feb 2024), VHQ Media (delisted/ceased), Picture Shop UK (sold/rebranded
// 2025 → The Farm + Home Post). Companies change fast — re-verify before booking.

export type VendorType =
  | "Post facility" | "Colour" | "VFX" | "Animation" | "Audio" | "DIT/Dailies"
  | "Film lab" | "DCP/QC" | "Captions" | "Studio" | "Camera rental"
  | "Software" | "Hardware" | "Storage/transfer";

export type VendorRegion = "NZ" | "AU" | "SEA" | "US" | "UK" | "France" | "Germany" | "WEU" | "Global";

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

export const VENDOR_REGIONS: VendorRegion[] = ["NZ", "AU", "SEA", "US", "UK", "France", "Germany", "WEU", "Global"];

export const VENDOR_REGION_LABEL: Record<VendorRegion, string> = {
  NZ: "New Zealand", AU: "Australia", SEA: "SE Asia", US: "United States", UK: "United Kingdom",
  France: "France", Germany: "Germany", WEU: "Western Europe", Global: "Global",
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

/** When the directory was last verified end-to-end. */
export const VENDORS_VERIFIED = "June 2026";

/** Next scheduled re-verification (≈6-month cadence). See docs/vendor-directory-maintenance.md. */
export const VENDORS_REVERIFY_BY = "December 2026";

/** Curated answers to the questions post supervisors actually ask of a vendor list. */
export interface VendorScenario { q: string; a: string; }
export const VENDOR_SCENARIOS: VendorScenario[] = [
  {
    q: "A show shoots 35mm film sections (à la Wuthering Heights) — who develops + scans it?",
    a: "UK: Cinelab Film & Digital (Slough) or Kodak Film Lab London (Pinewood) — both develop ECN-2 and scan. US: FotoKem (Burbank) in the west; Kodak Film Lab New York (Long Island City) or Metropolis Post (Manhattan) in the east; Kodak Film Lab Atlanta in the south. France: Silverway Paris (develop + scan + DCP). Germany/Benelux: Andec (Berlin), Color by DeJonghe (Kortrijk), Haghefilm (Amsterdam, archival). Italy: Augustus Color or Cinecittà's lab (Rome). NZ/AU: no verified production-scale ECN-2 lab — small-gauge only (Rewind Sydney 16mm, Nano Lab Super 8); productions ship negative to FotoKem (LA) or Cinelab (UK), with scanning back home (Park Road Wellington, ROAR Melbourne). SE Asia: none — negative ships to IMAGICA (Tokyo) or the labs above.",
  },
  {
    q: "I'm in Auckland and need to master + deliver a feature DCP for international release — who do I use?",
    a: "Grade/finish + DCI mastering in Auckland: Images & Sound or Department of Post (full-service), The Sugarworks (boutique). For the full theatrical route (Dolby-certified stages, picture + Atmos + DCP under one roof) it's Park Road Post in Wellington. Then have the DCP QC'd on a cinema server, and run international duplication, electronic delivery and KDMs through a distribution servicer: FATS Media Lab (AU/NZ cinemas), Motion Picture Solutions (London/LA — global), Deluxe, or Qube Wire (self-serve worldwide KDM/delivery). Festival-only releases can use Simple DCP (US) or Mocha Chai (Singapore).",
  },
  {
    q: "Who handles theatrical distribution servicing + KDMs?",
    a: "Motion Picture Solutions (London/LA) and Deluxe are the global majors; Qube Wire is the self-serve worldwide platform; CineSend covers North-American e-delivery and festivals. Regionally: FATS Media Lab (AU/NZ), DCP Manufaktur (Berlin), Juxtafilms (Kuala Lumpur), IndoDCP (Jakarta), Mocha Chai (Singapore).",
  },
  {
    q: "Film restoration / archive scanning — who's credible?",
    a: "NZ: Park Road Post. UK: R3store Studios, Cinelab, Dragon DI. France: L'Image Retrouvée (Paris arm of L'Immagine Ritrovata Bologna). Netherlands: Haghefilm. Germany: CinePostproduction, Andec. Italy: Augustus Color. US: FotoKem, Roundabout, Colorlab, NBCU StudioPost. Philippines: Central Digital Lab (191+ Filipino classics).",
  },
];

export const VENDORS: Vendor[] = [
  // ---- New Zealand ----
  { name: "Park Road Post", types: ["Post facility", "Colour", "Audio", "Film lab", "DCP/QC", "Studio"], region: "NZ", city: "Wellington", blurb: "Feature sound, DI, restoration, film scanning, DCP", url: "https://www.parkroad.co.nz" },
  { name: "The Rebel Fleet", types: ["DIT/Dailies", "Storage/transfer"], region: "NZ", city: "Auckland", blurb: "On-set workflow, DIT, cloud dailies — NZ/AU/APAC", url: "https://www.rebelfleet.co.nz" },
  { name: "Department of Post", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "NZ", city: "Auckland", blurb: "End-to-end editorial, picture finishing and audio", url: "https://www.departmentofpost.com" },
  { name: "Images & Sound", types: ["Post facility", "Colour", "VFX", "Animation", "Audio", "DIT/Dailies", "DCP/QC"], region: "NZ", city: "Auckland", blurb: "Complete post: grade, VFX, Atmos sound, DCP", url: "https://www.imagesandsound.co.nz" },
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

  // ---- Australia ----
  { name: "Spectrum Films", types: ["Post facility", "Colour", "VFX", "Audio", "DCP/QC"], region: "AU", city: "Sydney", blurb: "Picture, sound and VFX; family-run since 1964", url: "https://spectrumfilms.com.au" },
  { name: "Cutting Edge", types: ["Post facility", "DIT/Dailies", "VFX", "Colour", "Audio"], region: "AU", city: "Brisbane", blurb: "Full-service post with dailies and DIT", url: "https://www.cuttingedge.com.au" },
  { name: "KOJO", types: ["Post facility", "DIT/Dailies", "VFX", "Colour"], region: "AU", city: "Adelaide", blurb: "Lens-to-screen post, data management and DI", url: "https://kojo.co" },
  { name: "The Post Lounge", types: ["Post facility", "DIT/Dailies", "Colour", "VFX", "Audio"], region: "AU", city: "Sydney", blurb: "Near-set and in-facility dailies, data services", url: "https://www.thepostlounge.com" },
  { name: "ZIGZAG Post", types: ["Post facility", "DIT/Dailies", "Colour", "Audio", "DCP/QC"], region: "AU", city: "Sydney", blurb: "Dailies processing, colour grade and mastering", url: "https://www.zigzagpost.com" },
  { name: "Eden Studios", types: ["Colour"], region: "AU", city: "Sydney", blurb: "Dolby Vision / Atmos grade and finish facility", url: "https://edenstudios.com.au" },
  { name: "Rising Sun Pictures", types: ["VFX"], region: "AU", city: "Adelaide", blurb: "Hollywood feature VFX (Pitch Black group)", url: "https://rsp.com.au" },
  { name: "FIN Design + Effects", types: ["VFX"], region: "AU", city: "Sydney", blurb: "VFX and design; Sydney, Melbourne, Gold Coast", url: "https://www.findesign.com.au" },
  { name: "Alt.VFX", types: ["VFX"], region: "AU", city: "Brisbane", blurb: "VFX and virtual production", url: "https://www.altvfx.com" },
  { name: "Luma Pictures", types: ["VFX"], region: "AU", city: "Melbourne", blurb: "Independent feature-film visual effects studio", url: "https://www.lumapictures.com" },
  { name: "Framestore Melbourne", types: ["VFX"], region: "AU", city: "Melbourne", blurb: "High-end feature VFX (formerly Method Studios)", url: "https://www.framestore.com" },
  { name: "Heckler", types: ["VFX"], region: "AU", city: "Sydney", blurb: "VFX, CGI, design, animation, edit and colour", url: "https://heckler.tv" },
  { name: "Soundfirm", types: ["Audio"], region: "AU", city: "Melbourne", blurb: "Sound mix, ADR, Atmos; Melbourne and Sydney", url: "https://www.soundfirm.com" },
  { name: "Trackdown", types: ["Audio"], region: "AU", city: "Sydney", blurb: "Scoring stage, ADR, Foley, sound post", url: "https://trackdown.com.au" },
  { name: "ROAR Digital", types: ["Film lab"], region: "AU", city: "Melbourne", blurb: "Film SCANNING, restoration, mastering (no dev)", url: "https://roardigital.com.au" },
  { name: "Nano Lab", types: ["Film lab"], region: "AU", city: "Daylesford", blurb: "Super 8 small-gauge processing and supply", url: "https://nanolab.com.au" },
  { name: "Rewind Photo Lab", types: ["Film lab"], region: "AU", city: "Sydney", blurb: "Small-gauge S8/16mm ECN-2 processing + scans", url: "https://rewindphotolab.com.au" },
  { name: "FATS Media Lab", types: ["DCP/QC", "Storage/transfer"], region: "AU", city: "Sydney", blurb: "DCP mastering, QC, AU/NZ cinema distribution", url: "https://fats.com.au" },
  { name: "The Finishing Room", types: ["DCP/QC"], region: "AU", city: "Sydney", blurb: "DCP mastering and Dolby-tested cinema deliverables", url: "https://www.finishingroom.com.au" },
  { name: "Unravel", types: ["DCP/QC"], region: "AU", city: "Melbourne", blurb: "Cinema-ready DCP mastering for films and trailers", url: "https://www.unravel.com.au" },
  { name: "Post Lab", types: ["DCP/QC"], region: "AU", city: "Melbourne", blurb: "2K/4K DCP creation and worldwide distribution", url: "https://www.postlab.io" },
  { name: "Panavision Australia", types: ["Camera rental"], region: "AU", city: "Sydney", blurb: "Cinema camera, lens, grip and lighting rental", url: "https://www.panavision.com.au" },
  { name: "Lemac", types: ["Camera rental"], region: "AU", city: "Melbourne", blurb: "Camera and digital cinema rental", url: "https://www.lemac.com.au" },

  // ---- SE Asia ----
  { name: "Infinite Studios", types: ["Post facility", "Colour", "VFX", "Animation", "DCP/QC", "Studio"], region: "SEA", city: "Singapore", blurb: "One-stop post + Batam stages and backlot", url: "https://www.infinitestudios.com.sg" },
  { name: "Nine-V Post", types: ["Post facility", "Colour", "DCP/QC"], region: "SEA", city: "Singapore", blurb: "Boutique online, grade, Dolby Vision HDR", url: "https://www.nine-v.com" },
  { name: "Mark Song Grades", types: ["Colour"], region: "SEA", city: "Singapore", blurb: "Dolby Vision colourist; Caméra d'Or credit", url: "https://marksonggrades.com" },
  { name: "Mocha Chai Laboratories", types: ["Post facility", "Colour", "Audio", "DCP/QC"], region: "SEA", city: "Singapore", blurb: "Dolby Vision/Atmos house; 1,500+ DCPs", url: "https://mochachailab.com" },
  { name: "Doppler Soundlab", types: ["Audio"], region: "SEA", city: "Singapore", blurb: "Dolby Atmos mix and sound design, film/games", url: "https://doppler.sg" },
  { name: "Showtec Film Gear", types: ["Camera rental"], region: "SEA", city: "Singapore", blurb: "ARRI/RED rental (ex-Camwerkz rental business)", url: "https://camwerkz.com" },
  { name: "White Light Post", types: ["Post facility", "Colour", "DIT/Dailies", "DCP/QC"], region: "SEA", city: "Bangkok", blurb: "Top Thai DI lab — int'l features, Netflix", url: "https://whitelightpost.com" },
  { name: "Kantana Post Production", types: ["Post facility", "Colour", "Audio", "VFX", "Studio"], region: "SEA", city: "Bangkok", blurb: "Full post + ICVFX LED volume (digital-only now)", url: "https://www.kantanadigital.com" },
  { name: "One Cool Production", types: ["Post facility", "Colour", "DIT/Dailies", "Audio", "DCP/QC"], region: "SEA", city: "Bangkok", blurb: "HK-backed dailies-to-DCP DI house", url: "https://onecool.co.th" },
  { name: "The Post Bangkok", types: ["Post facility", "Colour", "VFX"], region: "SEA", city: "Bangkok", blurb: "Veteran film and commercials post house", url: "https://thepostbangkok.com" },
  { name: "The Monk Studios", types: ["Animation", "VFX"], region: "SEA", city: "Bangkok", blurb: "Feature animation and VFX (Ne Zha 2 work)", url: "https://www.themonkstudios.com" },
  { name: "Igloo Studio", types: ["Animation", "VFX"], region: "SEA", city: "Bangkok", blurb: "3D animation studio; award-winning character work", url: "https://igloostudio.com" },
  { name: "RiFF Studio", types: ["Animation", "VFX"], region: "SEA", city: "Bangkok", blurb: "130-artist animation studio, features and games", url: "https://riff-studio.com" },
  { name: "Yggdrazil Group", types: ["VFX", "Animation", "Post facility"], region: "SEA", city: "Bangkok", blurb: "SET-listed VFX/CG and virtual production", url: "https://www.ygg-cg.com" },
  { name: "Base FX Kuala Lumpur", types: ["VFX"], region: "SEA", city: "Kuala Lumpur", blurb: "Hollywood-tier VFX (Base Media group)", url: "https://www.base-fx.com" },
  { name: "Lemon Sky Studios", types: ["Animation"], region: "SEA", city: "Kuala Lumpur", blurb: "Major game-art and animation studio", url: "https://www.lemonskystudios.com" },
  { name: "Juxtafilms", types: ["DCP/QC", "Post facility"], region: "SEA", city: "Kuala Lumpur", blurb: "KL DCP mastering, KDMs and cinema QC", url: "https://juxtafilms.com" },
  { name: "Digital Pixels Post", types: ["Post facility", "Colour", "Audio", "DCP/QC"], region: "SEA", city: "Johor", blurb: "On-lot post at Iskandar Malaysia Studios", url: "https://iskandarmalaysiastudios.com" },
  { name: "Lumine Studio", types: ["VFX", "Animation"], region: "SEA", city: "Jakarta", blurb: "Film VFX — Alice in Borderland S3 credit", url: "https://luminestudio.com" },
  { name: "Brown Bag Films Bali", types: ["Animation"], region: "SEA", city: "Denpasar", blurb: "3D assets-to-comp for global series", url: "https://www.brownbagfilms.com" },
  { name: "IndoDCP", types: ["DCP/QC"], region: "SEA", city: "Jakarta", blurb: "Jakarta DCP mastering and cinema QC", url: "https://indodcp.com" },
  { name: "Bad Clay Studio", types: ["VFX"], region: "SEA", city: "Ho Chi Minh City", blurb: "Leading Vietnamese film VFX; Netflix credits", url: "https://bad-clay.com" },
  { name: "Sparx* (Virtuos)", types: ["Animation", "VFX"], region: "SEA", city: "Ho Chi Minh City", blurb: "600-staff cinematics and animation studio", url: "https://www.sparx.com" },
  { name: "CYCLO VFX", types: ["VFX"], region: "SEA", city: "Ho Chi Minh City", blurb: "Feature VFX; Netflix and Disney+ work", url: "https://cyclo.vn" },
  { name: "Central Digital Lab", types: ["Post facility", "Colour", "VFX", "DCP/QC", "Film lab"], region: "SEA", city: "Manila", blurb: "Manila DI/DCP + film restoration hub", url: "https://centraldigitallab.net" },
  { name: "Hit Productions", types: ["Audio", "Post facility"], region: "SEA", city: "Manila", blurb: "Atmos audio and video post", url: "https://hitproductions.net" },
  { name: "Optima Digital", types: ["Post facility", "VFX", "Colour"], region: "SEA", city: "Manila", blurb: "Ads and features VFX and finishing", url: "https://optimadigital.com" },
  { name: "Narra by Wildsound", types: ["Audio"], region: "SEA", city: "Quezon City", blurb: "Philippines' Dolby-accredited mix stages", url: "https://narrabywildsound.com" },

  // ---- United States ----
  { name: "FotoKem", types: ["Film lab", "Colour", "Post facility", "DIT/Dailies", "DCP/QC"], region: "US", city: "Burbank", blurb: "Full lab: 16/35/65mm dev, DI, dailies, prints", url: "https://fotokem.com" },
  { name: "Kodak Film Lab New York", types: ["Film lab"], region: "US", city: "Long Island City", blurb: "Kodak-run ECN-2 16/35 dev + 6.5K scanning", url: "https://www.kodak.com/en/motion/page/kodak-film-labs" },
  { name: "Kodak Film Lab Atlanta", types: ["Film lab"], region: "US", city: "Atlanta", blurb: "ECN-2 16/35 dev + scanning, Southeast US", url: "https://www.kodak.com/en/motion/page/kodak-film-labs" },
  { name: "Metropolis Post", types: ["Film lab", "Post facility", "Colour", "DIT/Dailies"], region: "US", city: "New York", blurb: "NYC lab: 35mm neg dev, 4K HDR scans, dailies", url: "https://www.metpostny.com" },
  { name: "Cinelab (US)", types: ["Film lab"], region: "US", city: "New Bedford", blurb: "8/16/35 dev, scans to 9.4K, prints, archival", url: "https://www.cinelab.com" },
  { name: "Colorlab", types: ["Film lab"], region: "US", city: "Rockville", blurb: "16/35 + S8 colour/B&W dev, printing, scans", url: "https://www.colorlab.com" },
  { name: "Pro8mm", types: ["Film lab"], region: "US", city: "Burbank", blurb: "Super 8/16mm stock, in-house dev + 6.5K scans", url: "https://www.pro8mm.com" },
  { name: "Spectra Film & Video", types: ["Film lab"], region: "US", city: "North Hollywood", blurb: "Boutique S8/16mm processing and scanning", url: "https://spectrafilmandvideo.com" },
  { name: "Gamma Ray Digital", types: ["Film lab"], region: "US", city: "Boston", blurb: "SCAN-ONLY: archival 8mm–70mm up to 14K", url: "https://www.gammaraydigital.com" },
  { name: "Company 3", types: ["Colour", "Post facility", "DIT/Dailies", "DCP/QC"], region: "US", city: "LA / NY / Atlanta", blurb: "Top-tier feature and episodic colour/finishing", url: "https://www.company3.com" },
  { name: "Picture Shop", types: ["Colour", "Post facility", "DIT/Dailies", "VFX"], region: "US", city: "Hollywood", blurb: "Streamland US flagship; 13 colour bays, 5 DI theatres", url: "https://www.pictureshop.com" },
  { name: "Light Iron", types: ["Colour", "DIT/Dailies", "Post facility"], region: "US", city: "Hollywood", blurb: "Employee-owned dailies, colour, mastering house", url: "https://www.lightiron.com" },
  { name: "Harbor", types: ["Colour", "Audio", "DIT/Dailies", "Post facility"], region: "US", city: "New York", blurb: "Dailies-to-DI colour, sound, picture finishing", url: "https://harborpicturecompany.com" },
  { name: "Goldcrest Post New York", types: ["Post facility", "Colour", "Audio"], region: "US", city: "New York", blurb: "West Village colour, ADR, Atmos mix, editorial", url: "https://www.goldcrestpostny.com" },
  { name: "PostWorks New York", types: ["Post facility", "Colour", "Audio", "DIT/Dailies"], region: "US", city: "New York", blurb: "East Coast's largest finishing, dailies, scanning", url: "https://www.postworks.com" },
  { name: "Roundabout Entertainment", types: ["Post facility", "Colour", "Audio", "DCP/QC"], region: "US", city: "Burbank", blurb: "Colour, Atmos mix, ADR, QC for streamers", url: "https://www.roundabout.com" },
  { name: "The Foundation", types: ["Post facility", "Colour", "DIT/Dailies"], region: "US", city: "Burbank", blurb: "Dailies, online, colour opposite the WB lot", url: "https://thefoundationpost.com" },
  { name: "Nice Shoes", types: ["Colour", "VFX", "Animation"], region: "US", city: "New York", blurb: "Indie colour/VFX/design studio, NY + remote", url: "https://www.niceshoes.com" },
  { name: "Apache", types: ["Colour"], region: "US", city: "Santa Monica", blurb: "Colour-only boutique for spots and features", url: "https://www.apache.tv" },
  { name: "Color Collective", types: ["Colour"], region: "US", city: "New York", blurb: "Alex Bickel's award-winning feature colour house", url: "https://www.colorcollective.com" },
  { name: "Ntropic", types: ["Colour", "VFX"], region: "US", city: "LA / SF / NY", blurb: "Colour + VFX for ads, music, film", url: "https://www.ntropic.com" },
  { name: "Periscope Post & Audio", types: ["Post facility", "Audio", "Colour", "DIT/Dailies"], region: "US", city: "Chicago + Hollywood", blurb: "Full picture and audio post, two cities", url: "https://www.periscopepa.com" },
  { name: "Post Haste Digital", types: ["Post facility", "Audio", "DCP/QC", "Captions"], region: "US", city: "Los Angeles", blurb: "Westside audio/video post, Atmos, mastering", url: "https://posthastedigital.com" },
  { name: "Formosa Group", types: ["Audio"], region: "US", city: "Hollywood", blurb: "Leading independent feature/TV sound house", url: "https://www.formosagroup.com" },
  { name: "Skywalker Sound", types: ["Audio"], region: "US", city: "Marin County", blurb: "Lucasfilm's sound design and mixing campus", url: "https://www.skysound.com" },
  { name: "WB Post Production Creative Services", types: ["Audio", "Post facility"], region: "US", city: "Burbank", blurb: "WB lot sound: mix stages, ADR, scoring", url: "https://www.wbppcs.com" },
  { name: "Sony Pictures Post Production", types: ["Audio", "Post facility"], region: "US", city: "Culver City", blurb: "12 mix stages, scoring, ADR on the Sony lot", url: "https://www.sonypicturesstudios.com" },
  { name: "NBCUniversal StudioPost", types: ["Audio", "Post facility", "Colour"], region: "US", city: "Universal City", blurb: "Universal lot editorial, sound, DI, restoration", url: "https://www.studiopostnbcu.com" },
  { name: "Deluxe", types: ["DCP/QC", "Captions", "Post facility"], region: "US", city: "Burbank", blurb: "Global mastering, localization, cinema delivery", url: "https://www.bydeluxe.com" },
  { name: "Pixelogic", types: ["DCP/QC", "Captions"], region: "US", city: "Burbank", blurb: "Studio localization, sub/dub, DCP, QC", url: "https://pixelogicmedia.com" },
  { name: "Iyuno", types: ["Captions", "Audio", "DCP/QC"], region: "US", city: "Burbank", blurb: "World's largest dubbing/subtitling network", url: "https://iyuno.com" },
  { name: "Visual Data Media Services", types: ["DCP/QC", "Captions", "Post facility"], region: "US", city: "Burbank", blurb: "Supply chain: mastering, captions, localization", url: "https://www.visualdatamedia.com" },
  { name: "Picture Head", types: ["Post facility", "DCP/QC", "Colour"], region: "US", city: "Hollywood", blurb: "Theatrical finishing + marketing post (Streamland)", url: "https://picturehead.com" },
  { name: "Simple DCP", types: ["DCP/QC"], region: "US", city: "Burbank", blurb: "DCP mastering, KDMs, festival + studio delivery", url: "https://simpledcp.com" },
  { name: "Qube Wire", types: ["DCP/QC", "Storage/transfer"], region: "US", city: "Burbank", blurb: "Self-serve global DCP/KDM delivery, 5,000+ cinemas", url: "https://www.qubewire.com" },
  { name: "CineSend", types: ["DCP/QC", "Storage/transfer"], region: "US", city: "Toronto", blurb: "Electronic DCP delivery; festivals, N. America", url: "https://www.cinesend.com" },
  { name: "Rev", types: ["Captions"], region: "US", city: "Austin", blurb: "Human/AI transcription, captions, subtitles", url: "https://www.rev.com" },
  { name: "3Play Media", types: ["Captions"], region: "US", city: "Boston", blurb: "Captions, subtitles, audio description", url: "https://www.3playmedia.com" },
  { name: "Verbit", types: ["Captions"], region: "US", city: "New York", blurb: "AI+human captions; absorbed VITAC broadcast", url: "https://verbit.ai" },
  { name: "GoTranscript", types: ["Captions"], region: "US", city: "Online", blurb: "Human transcription/captions marketplace", url: "https://gotranscript.com" },
  { name: "Otter.ai", types: ["Captions"], region: "US", city: "Mountain View", blurb: "AI transcription; not broadcast-spec captions", url: "https://otter.ai" },
  { name: "CaptioningStar", types: ["Captions"], region: "US", city: "New York", blurb: "Broadcast/event captioning + subtitling bureau", url: "https://www.captioningstar.com" },
  { name: "Aberdeen Broadcast Services", types: ["Captions"], region: "US", city: "Rancho Santa Margarita", blurb: "Captions, subtitles, transcription for broadcast", url: "https://www.aberdeen.io" },

  // ---- United Kingdom ----
  { name: "Goldcrest Post", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "UK", city: "London", blurb: "Feature/TV picture and sound finishing, Soho", url: "https://goldcrestfilms.com/post-production" },
  { name: "Molinare", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "UK", city: "London", blurb: "Soho picture, sound, VFX, DI — since 1973", url: "https://molinare.co.uk" },
  { name: "The Farm", types: ["Post facility", "Colour", "VFX", "Audio"], region: "UK", city: "London", blurb: "Restored brand — Granary Media, ex-Picture Shop UK", url: "https://farmgroup.tv" },
  { name: "Home Post Production", types: ["Post facility", "Colour", "Audio"], region: "UK", city: "Bristol + Manchester", blurb: "Ex-Picture Shop facilities under Northstar", url: "https://homepostproduction.com" },
  { name: "Envy Post Production", types: ["Post facility", "Colour", "VFX", "Animation", "Audio"], region: "UK", city: "London", blurb: "Online, grading, audio — Fitzrovia post house", url: "https://www.envypost.co.uk" },
  { name: "Halo Post Production", types: ["Post facility", "Colour", "Audio", "DIT/Dailies", "DCP/QC"], region: "UK", city: "London", blurb: "Grading, online, sound — Soho post", url: "https://www.halopost.com" },
  { name: "OnSight", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "UK", city: "London", blurb: "Dailies, picture post, VFX, sound", url: "https://onsight.co.uk" },
  { name: "Films at 59", types: ["Post facility", "Colour", "Audio", "DIT/Dailies"], region: "UK", city: "Bristol", blurb: "Picture/sound post and equipment hire", url: "https://filmsat59.com" },
  { name: "Twickenham Film Studios", types: ["Post facility", "Audio", "Studio"], region: "UK", city: "London", blurb: "Sound dubbing, ADR, stages + VP wall", url: "https://www.twickenhamstudios.com" },
  { name: "Company 3 London", types: ["Colour", "DIT/Dailies"], region: "UK", city: "London", blurb: "Feature/episodic colour grading, Chancery Lane", url: "https://www.company3.com/locations/london" },
  { name: "Harbor London", types: ["Colour", "Post facility", "Audio"], region: "UK", city: "London", blurb: "Harbor's UK studios — colour, ads + features", url: "https://harborpicturecompany.com" },
  { name: "Cheat", types: ["Colour"], region: "UK", city: "London", blurb: "Leading indie colour house — film, TV, ads", url: "https://cheat.co.uk" },
  { name: "Untold Studios", types: ["VFX", "Animation", "Colour"], region: "UK", city: "London", blurb: "Creative studio — VFX, design, colour", url: "https://www.untold.studio" },
  { name: "Mission Digital", types: ["DIT/Dailies", "Colour"], region: "UK", city: "Shepperton", blurb: "HDR grading, dailies and DIT services", url: "https://www.missiondigital.co.uk" },
  { name: "HIJACK Post Production", types: ["DIT/Dailies", "Post facility", "DCP/QC"], region: "UK", city: "London", blurb: "On-set DIT, data management and digital dailies", url: "https://hijackpost.com" },
  { name: "Notorious DIT", types: ["DIT/Dailies"], region: "UK", city: "London", blurb: "On-set DIT, data management and dailies lab", url: "https://notorious-dit.co.uk" },
  { name: "Digital Orchard Group", types: ["DIT/Dailies", "Film lab"], region: "UK", city: "Chalfont St Giles", blurb: "DITs, dailies, film scanning — rebranded 2025", url: "https://digitalorchardgroup.com" },
  { name: "Pixel and Process", types: ["DIT/Dailies"], region: "UK", city: "Cardiff", blurb: "Digital dailies, DIT and camera-to-post workflow", url: "https://pixelandprocess.co.uk" },
  { name: "Coffee & TV", types: ["Colour", "VFX"], region: "UK", city: "London", blurb: "Colour, VFX, finishing — Omnicom-owned", url: "https://coffeeand.tv" },
  { name: "Framestore", types: ["VFX"], region: "UK", city: "London", blurb: "Oscar-winning feature and episodic VFX", url: "https://www.framestore.com" },
  { name: "DNEG", types: ["VFX"], region: "UK", city: "London", blurb: "Academy Award-winning VFX, Fitzrovia", url: "https://www.dneg.com" },
  { name: "Cinesite", types: ["VFX"], region: "UK", city: "London", blurb: "Feature VFX and animation studio", url: "https://cinesite.com" },
  { name: "ILM London", types: ["VFX"], region: "UK", city: "London", blurb: "Lucasfilm feature and episodic VFX", url: "https://www.ilm.com/locations/london" },
  { name: "The Mill (TransPerfect)", types: ["VFX"], region: "UK", city: "London", blurb: "Relaunched Oct 2025 under TransPerfect", url: "https://www.themill.com" },
  { name: "One of Us", types: ["VFX"], region: "UK", city: "London", blurb: "Feature/episodic VFX — The Crown, features", url: "https://weareoneofus.com" },
  { name: "BlueBolt", types: ["VFX"], region: "UK", city: "London", blurb: "Independent VFX — drama and features", url: "https://www.blue-bolt.com" },
  { name: "Union VFX", types: ["VFX"], region: "UK", city: "London", blurb: "Invisible effects and CG environments, Soho", url: "https://www.unionvfx.com" },
  { name: "Outpost VFX", types: ["VFX"], region: "UK", city: "Bournemouth", blurb: "Environments, creatures and digital makeup VFX", url: "https://www.outpost-vfx.com" },
  { name: "Warner Bros De Lane Lea", types: ["Audio"], region: "UK", city: "London", blurb: "Sound and picture post, Soho", url: "https://www.wbsl.com/de-lane-lea" },
  { name: "LipSync Post", types: ["Post facility", "Audio", "Colour", "DCP/QC"], region: "UK", city: "London", blurb: "Picture + sound finishing, grading, DCP", url: "https://lipsync.co.uk" },
  { name: "Hackenbacker", types: ["Audio"], region: "UK", city: "London", blurb: "Sound design, ADR, foley, mixing", url: "https://www.hackenbacker.com" },
  { name: "Boom Post", types: ["Audio"], region: "UK", city: "London", blurb: "Sound editing, foley, ADR, mixing", url: "https://www.boompost.co.uk" },
  { name: "Cinelab Film & Digital", types: ["Film lab", "DIT/Dailies"], region: "UK", city: "Slough", blurb: "UK's full-service lab: 16/35/65 dev, scan, dailies", url: "https://www.cinelab.co.uk" },
  { name: "Kodak Film Lab London", types: ["Film lab"], region: "UK", city: "Pinewood", blurb: "ECN-2 processing and scanning at Pinewood", url: "https://www.kodak.com/en/motion/page/kodak-film-labs" },
  { name: "Dragon Digital Intermediate", types: ["Film lab", "DCP/QC"], region: "UK", city: "Bridgend", blurb: "Film scanning, restoration, DI, DCP mastering", url: "https://dragondi.co.uk" },
  { name: "R3store Studios", types: ["Film lab"], region: "UK", city: "London", blurb: "Film restoration, scanning, grading", url: "https://r3storestudios.com" },
  { name: "Motion Picture Solutions", types: ["DCP/QC", "Storage/transfer"], region: "UK", city: "London", blurb: "Global DCP mastering, distribution + KDMs", url: "https://www.motionpicturesolutions.com" },
  { name: "Deluxe London", types: ["DCP/QC"], region: "UK", city: "London", blurb: "DCP mastering, QC, cinema distribution", url: "https://www.bydeluxe.com" },
  { name: "EIKON Group", types: ["DCP/QC", "Captions"], region: "UK", city: "London", blurb: "Content mastering, QC and localization", url: "https://eikon.group" },
  { name: "ARRI Rental UK", types: ["Camera rental"], region: "UK", city: "Uxbridge", blurb: "Camera, lighting and grip rental", url: "https://www.arrirental.co.uk" },
  { name: "Panavision UK", types: ["Camera rental"], region: "UK", city: "Greenford", blurb: "Cinema camera, lens and grip rental", url: "https://uk.panavision.com" },
  { name: "Movietech Camera Rentals", types: ["Camera rental"], region: "UK", city: "Pinewood", blurb: "Camera and grip rental, Pinewood", url: "https://www.movietech.co.uk" },
  { name: "Procam Take 2", types: ["Camera rental"], region: "UK", city: "London", blurb: "Digital cinematography camera and kit hire", url: "https://procamtake2.com" },
  { name: "CaptionHub", types: ["Captions"], region: "UK", city: "London", blurb: "AI captions and subtitles for video", url: "https://www.captionhub.com" },

  // ---- France ----
  { name: "Silverway Paris", types: ["Film lab", "Colour", "Post facility", "DCP/QC"], region: "France", city: "Paris", blurb: "DEVELOPS S8/16/35 + scan, grade, DCP, 4K theatre", url: "https://www.silverway.paris" },
  { name: "TransPerfect Media (ex-Hiventy)", types: ["DCP/QC", "Captions", "Audio", "Film lab"], region: "France", city: "Joinville-le-Pont", blurb: "Localization, dubbing, restoration, DCP", url: "https://www.transperfect.com/media" },
  { name: "Le Labo Paris", types: ["Post facility", "Colour", "VFX", "DIT/Dailies"], region: "France", city: "Paris", blurb: "Boutique finishing — conform, grading, VFX", url: "http://lelabo.paris" },
  { name: "Cosmodigital", types: ["Post facility", "Colour", "VFX", "DIT/Dailies", "DCP/QC"], region: "France", city: "Paris", blurb: "Digital post from shoot to delivery", url: "https://www.cosmo-digital.com" },
  { name: "M141", types: ["Colour"], region: "France", city: "Paris", blurb: "Feature-film grading house (Titane, Palme d'Or)", url: "http://www.m141.fr" },
  { name: "Mikros Animation (Rodeo FX)", types: ["Animation", "VFX"], region: "France", city: "Paris", blurb: "Feature animation — now a Rodeo FX company", url: "https://www.mikrosanimation.com" },
  { name: "The Mill Paris (TransPerfect)", types: ["VFX"], region: "France", city: "Paris", blurb: "Relaunched 2025 under TransPerfect ownership", url: "https://www.themill.com" },
  { name: "The Yard VFX", types: ["VFX"], region: "France", city: "Paris", blurb: "Feature/series VFX — Stranger Things credits", url: "https://www.theyard-vfx.com" },
  { name: "Mac Guff", types: ["VFX", "Animation"], region: "France", city: "Paris", blurb: "Veteran Paris VFX and animation studio", url: "https://macguff.com" },
  { name: "BUF", types: ["VFX"], region: "France", city: "Paris", blurb: "Pioneering French CGI and visual effects house", url: "https://buf.com" },
  { name: "Digital District", types: ["VFX", "Colour"], region: "France", city: "Paris", blurb: "VFX, post-production and colour grading", url: "https://www.digital-district.fr" },
  { name: "L'Image Retrouvée", types: ["Film lab"], region: "France", city: "Paris", blurb: "Restoration + 4K scanning (L'Immagine Ritrovata)", url: "https://imageretrouvee.fr" },
  { name: "Titrafilm", types: ["Captions", "Audio", "DCP/QC"], region: "France", city: "Paris", blurb: "Subtitling, dubbing, accessibility since 1933", url: "https://titrafilm.com" },
  { name: "Poly Son", types: ["Audio"], region: "France", city: "Paris", blurb: "Picture and sound post, Dolby Atmos mixing", url: "https://polyson.fr" },
  { name: "Piste Rouge", types: ["Audio"], region: "France", city: "Paris", blurb: "Sound design, music, Dolby Atmos mixing", url: "https://pisterouge.com" },
  { name: "Dubbing Brothers", types: ["Audio"], region: "France", city: "Saint-Denis", blurb: "French-language dubbing for film and TV", url: "https://www.dubbing-brothers.com" },
  { name: "RVZ", types: ["Camera rental"], region: "France", city: "Ivry-sur-Seine", blurb: "Camera, lens and lighting rental, Paris", url: "https://rvz-location.fr" },
  { name: "TSF", types: ["Camera rental", "Studio"], region: "France", city: "Paris", blurb: "Camera, grip, lighting, studios and backlots", url: "https://groupe-tsf.com" },
  { name: "Transpacam", types: ["Camera rental"], region: "France", city: "Gennevilliers", blurb: "Camera and lens rental for film, TV", url: "https://www.transpacam.com" },
  { name: "Be4Post", types: ["DIT/Dailies", "Hardware", "Storage/transfer"], region: "France", city: "Paris", blurb: "DIT stations, dailies prep and data management", url: "https://www.be4post.com" },

  // ---- Germany ----
  { name: "The Post Republic", types: ["Post facility", "Colour", "Audio", "VFX", "DIT/Dailies"], region: "Germany", city: "Berlin", blurb: "End-to-end picture + sound; 9 DI suites", url: "https://post-republic.com" },
  { name: "Cine Plus", types: ["Post facility", "Colour", "Camera rental", "Studio"], region: "Germany", city: "Berlin", blurb: "Full-service production, post and rental", url: "https://www.cine-plus.de" },
  { name: "PHAROS — The Post Group", types: ["Post facility", "Colour", "VFX", "Audio", "DIT/Dailies", "DCP/QC"], region: "Germany", city: "Munich", blurb: "Ex-ARRI Media; script-to-screen post", url: "https://www.pharos.de" },
  { name: "CinePostproduction", types: ["Post facility", "Colour", "DIT/Dailies", "Film lab", "DCP/QC"], region: "Germany", city: "Munich", blurb: "4K/HDR post, COPRA dailies, restoration", url: "https://cinepostproduction.de" },
  { name: "Trixter", types: ["VFX", "Animation"], region: "Germany", city: "Munich", blurb: "Cinesite-owned VFX; restructured 2025, active", url: "https://www.trixter.de" },
  { name: "RISE Visual Effects", types: ["VFX", "Animation"], region: "Germany", city: "Berlin", blurb: "Germany's top film VFX; 350+ artists", url: "https://www.risefx.com" },
  { name: "Eyeline (ex-Scanline VFX)", types: ["VFX"], region: "Germany", city: "Munich", blurb: "Netflix unit — Scanline + Eyeline merged 2025", url: "https://www.eyelinestudios.com" },
  { name: "Optical Art", types: ["Post facility", "Colour", "VFX", "DIT/Dailies"], region: "Germany", city: "Hamburg", blurb: "Cinema/TV picture post since 1987", url: "https://www.opticalart.de" },
  { name: "Andec Filmtechnik", types: ["Film lab"], region: "Germany", city: "Berlin", blurb: "DEVELOPS S8–35mm ECN-2/E-6/B&W; ARRISCAN", url: "https://andecfilm.de" },
  { name: "Rotor Film", types: ["Post facility", "Colour", "Audio"], region: "Germany", city: "Potsdam", blurb: "Babelsberg grading + large Atmos mix stages", url: "https://rotor-film.com" },
  { name: "toneworx", types: ["Audio"], region: "Germany", city: "Hamburg", blurb: "Audio post, dubbing, Atmos; five cities", url: "https://www.toneworx.com" },
  { name: "DCP Manufaktur", types: ["DCP/QC"], region: "Germany", city: "Berlin", blurb: "Hand-built, QC'd DCPs and KDMs since 2011", url: "https://dcpmanufaktur.com" },
  { name: "ARRI Rental", types: ["Camera rental"], region: "Germany", city: "Munich", blurb: "ALEXA 65; global rental network", url: "https://www.arrirental.com" },
  { name: "Ludwig Kameraverleih", types: ["Camera rental"], region: "Germany", city: "Munich", blurb: "Panavision DE partner; acquired MBF", url: "https://ludwigkamera.de" },
  { name: "FGV Schmidle", types: ["Camera rental", "Studio"], region: "Germany", city: "Munich", blurb: "Camera, grip, lighting + stage rental", url: "https://fgv-rental.de" },

  // ---- Western Europe ----
  { name: "Filmmore", types: ["Post facility", "Colour", "VFX", "Film lab"], region: "WEU", city: "Amsterdam", blurb: "Feature/doc post, VFX + restoration", url: "https://filmmore.eu" },
  { name: "Haghefilm", types: ["Film lab"], region: "WEU", city: "Amsterdam", blurb: "DEVELOPS + prints 16/35 B&W/colour; archival", url: "https://www.haghefilm.nl" },
  { name: "Posta Vermaas", types: ["Audio"], region: "WEU", city: "Amsterdam", blurb: "NL's top film audio; Atmos re-recording stage", url: "https://postavermaas.nl" },
  { name: "Color by DeJonghe", types: ["Film lab", "Colour", "DCP/QC"], region: "WEU", city: "Kortrijk, Belgium", blurb: "DEVELOPS 16/35 neg, prints, 6.5K scans", url: "https://www.postproduction.be" },
  { name: "Studio l'Equipe", types: ["Post facility", "Colour", "Audio", "Captions"], region: "WEU", city: "Brussels", blurb: "One-stop Belgian post; film dev claimed", url: "https://www.studio-equipe.be" },
  { name: "The Pack", types: ["VFX", "Animation", "Post facility", "DIT/Dailies"], region: "WEU", city: "Brussels", blurb: "Fridge + NOZON + Ace merger; three regions", url: "https://thepack.studio" },
  { name: "Sonhouse", types: ["Audio"], region: "WEU", city: "Brussels", blurb: "Film sound: ADR, foley, mix, dubbing", url: "https://www.sonhouse.com" },
  { name: "Option Media", types: ["Audio", "Captions"], region: "WEU", city: "Mechelen, Belgium", blurb: "Netflix-approved dubbing + subs; 75 languages", url: "https://www.optionmedia.be" },
  { name: "Augustus Color", types: ["Film lab", "Colour", "DCP/QC"], region: "WEU", city: "Rome", blurb: "DEVELOPS + prints 8/16/35; restoration", url: "https://www.augustuscolor.com" },
  { name: "Cinecittà", types: ["Studio", "Post facility", "Colour", "Audio", "Film lab"], region: "WEU", city: "Rome", blurb: "Stages + post; own 16/35 film lab", url: "https://www.cinecitta.com" },
  { name: "Frame by Frame", types: ["VFX", "Post facility", "Colour", "Audio"], region: "WEU", city: "Rome", blurb: "Full post + VFX; two-time David winner", url: "https://www.frame.it" },
  { name: "EDI Effetti Digitali Italiani", types: ["VFX"], region: "WEU", city: "Milan", blurb: "Milan VFX leader; film and episodic", url: "https://www.effettidigitali.it" },
  { name: "Proxima Milano", types: ["VFX", "Post facility", "Colour"], region: "WEU", city: "Milan", blurb: "VFX, CG + HDR finishing since 2003", url: "https://www.proximamilano.com" },
  { name: "El Ranchito", types: ["VFX"], region: "WEU", city: "Madrid", blurb: "Tier-1 VFX: GoT, Society of the Snow", url: "https://www.elranchito.es" },
  { name: "Deluxe Spain", types: ["Post facility", "Colour", "Audio", "Captions", "DIT/Dailies"], region: "WEU", city: "Madrid", blurb: "Dailies-to-DI + Netflix dubbing hub", url: "https://www.bydeluxe.com" },
  { name: "Free Your Mind", types: ["Post facility", "Colour"], region: "WEU", city: "Madrid", blurb: "Mistika DI + finishing; 4K screening room", url: "https://www.fym.tv" },
  { name: "Telson (Grupo Tres60)", types: ["Post facility", "Colour", "Audio"], region: "WEU", city: "Madrid", blurb: "Image + sound post; Atmos, Dolby Vision", url: "https://www.tres60.tv" },
  { name: "Best Digital", types: ["Audio", "Captions"], region: "WEU", city: "Madrid", blurb: "Dubbing + Atmos audio post group", url: "https://www.bestdigitalgroup.com" },
  { name: "Screen Scene", types: ["Post facility", "Colour", "VFX", "Audio"], region: "WEU", city: "Dublin", blurb: "Ireland's biggest post; Shōgun credits", url: "https://screenscene.ie" },
  { name: "EGG Post Production", types: ["Post facility", "Colour", "VFX"], region: "WEU", city: "Dublin", blurb: "Drama/doc post + VFX; 70+ staff", url: "https://egg.ie" },
  { name: "Outer Limits", types: ["Colour", "VFX", "Post facility"], region: "WEU", city: "Dublin", blurb: "Boutique grade + VFX for streamers", url: "https://outerlimits.ie" },
  { name: "Piranha Bar", types: ["VFX", "Animation", "Post facility"], region: "WEU", city: "Dublin", blurb: "VFX, mocap + entertainment TV post", url: "https://piranhabar.ie" },
  { name: "Cinegrell", types: ["Film lab", "DIT/Dailies", "Colour"], region: "WEU", city: "Zürich", blurb: "SCAN-ONLY now — dev moved to Andec Berlin", url: "https://cinegrell.ch" },
  { name: "Freestudios", types: ["Post facility", "Colour", "Audio"], region: "WEU", city: "Geneva", blurb: "Image + sound post for features/TV", url: "https://www.freestudios.ch" },
  { name: "Jingle Jungle", types: ["Audio"], region: "WEU", city: "Zürich", blurb: "Zürich audio post; cinema mixing stage", url: "https://www.jinglejungle.ch" },

  // ---- Global software ----
  { name: "Blackmagic Design", types: ["Software", "Hardware"], region: "Global", city: "Melbourne", blurb: "DaVinci Resolve — edit, grade, VFX, deliver", url: "https://www.blackmagicdesign.com" },
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

  // ---- Global film + captions ----
  { name: "Kodak", types: ["Film lab", "Hardware"], region: "Global", city: "Rochester", blurb: "Motion picture film stock; labs NY/Atlanta/London", url: "https://www.kodak.com/en/motion" },
  { name: "IMAGICA (Tokyo)", types: ["Film lab"], region: "Global", city: "Tokyo", blurb: "35/16mm developing — Asia-Pacific's pro lab", url: "https://www.imagica-ems.co.jp" },
  { name: "Happy Scribe", types: ["Captions"], region: "Global", city: "Barcelona", blurb: "Transcription and subtitles in 120+ languages", url: "https://www.happyscribe.com" },
  { name: "Amberscript", types: ["Captions"], region: "Global", city: "Amsterdam", blurb: "Transcription and subtitling, human and AI", url: "https://www.amberscript.com" },
];
