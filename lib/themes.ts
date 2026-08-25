export const themes = {
    michelin: {
      name: "Midnight Michelin",
      bg: "#09090B",       // Deep Obsidian Black
      cardBg: "#121214",   // Charcoal Surface
      primary: "#D4AF37",  // Luxury Gold
      accentGradient: "from-[#D4AF37]/20 to-transparent",
      fontHeading: "font-serif",
      badgeText: "SIGNATURE",
    },
    rustica: {
      name: "Trattoria Rustica",
      bg: "#1C1512",       // Warm Earthy Espresso
      cardBg: "#2A201C",   // Deep Terracotta Surface
      primary: "#E07A5F",  // Warm Rust / Terracotta
      accentGradient: "from-[#E07A5F]/20 to-transparent",
      fontHeading: "font-serif italic",
      badgeText: "CHEF'S SPECIAL",
    },
    izakaya: {
      name: "Neon Izakaya",
      bg: "#05050A",       // Cyber Dark
      cardBg: "#0F0F1A",   // Deep Indigo Surface
      primary: "#F72585",  // Electric Neon Pink
      accentGradient: "from-[#F72585]/20 to-transparent",
      fontHeading: "font-sans font-extrabold tracking-tight",
      badgeText: "POPULAR",
    }
  };
  
  // ⚠️ CHANGE THIS VARIABLE FOR EACH REPOSITORY:
  // Use 'michelin', 'rustica', or 'izakaya' depending on which repo you are working on.
  export const ACTIVE_THEME = themes.michelin;