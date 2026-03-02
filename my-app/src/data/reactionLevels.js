// reactionLevels.js
export const reactionLevels = [
  // --- 1. CATALYTIC HYDROGENATION ---
  // Syn Addition. H adds to same face.
  // If H adds Top (Wedge) -> Methyl pushed Bottom (Dash)
  // If H adds Bottom (Dash) -> Methyl pushed Top (Wedge)
  {
    id: 1,
    title: "Catalytic Hydrogenation",
    reagents: "H₂ / Pt",
    description: "Syn Addition of Hydrogen",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: H adds Wedge (Top)
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "H" }, { "id": 9, "x": 370, "y": 242.49, "label": "H" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 2, "to": 7, "order": 1, "style": "wedge" }, // Methyl Pushed Down (Dash)
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "striped" },   // H is Wedge
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "striped" }   // H is Wedge
        ]
      }
    ]
  },

  // --- 2. HALOGENATION ---
  // Anti Addition. 
  // If Br(C2) is Wedge -> Br(C3) is Dash.
  // Methyl Stereochem: Opposite to Br(C2).
  {
    id: 2,
    title: "Halogenation",
    reagents: "Br₂ / CCl₄",
    description: "Anti Addition of Bromine",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: Br(C2) Dash / Methyl Wedge / Br(C3) Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "Br" }, { "id": 9, "x": 370, "y": 242.49, "label": "Br" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 2, "to": 7, "order": 1, "style": "wedge" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "striped" }, // Br Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "wedge" }    // Br Wedge
        ]
      },
      { // Enantiomer B: Br(C2) Wedge / Methyl Dash / Br(C3) Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "Br" }, { "id": 9, "x": 370, "y": 242.49, "label": "Br" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "striped" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "wedge" },   // Br Wedge
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "striped" }  // Br Dash
        ]
      }
    ]
  },

  // --- 3. OXYHALOGENATION ---
  // Anti. OH on More Sub (C2). Br on Less Sub (C3).
  // Methyl opposite to OH.
  {
    id: 3,
    title: "Oxyhalogenation",
    reagents: "Br₂ / H₂O",
    description: "Anti Addition (OH to more sub, Br to less sub)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: OH Dash / Methyl Wedge / Br Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "OH" }, { "id": 9, "x": 370, "y": 242.49, "label": "Br" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 2, "to": 7, "order": 1, "style": "wedge" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "striped" }, // OH Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "wedge" }    // Br Wedge
        ]
      },
      { // Enantiomer B: OH Wedge / Methyl Dash / Br Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "OH" }, { "id": 9, "x": 370, "y": 242.49, "label": "Br" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "striped" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "wedge" },   // OH Wedge
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "striped" }  // Br Dash
        ]
      }
    ]
  },

  // --- 4. ALKOXYHALOGENATION ---
  // Anti. OCH3 on More Sub (C2). Br on Less Sub (C3).
  // Methyl opposite to OCH3.
  {
    id: 4,
    title: "Alkoxyhalogenation",
    reagents: "Br₂ / CH₃OH",
    description: "Anti Addition (OCH₃ to more sub, Br to less sub)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: OCH3 Dash / Methyl Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "OCH3" }, { "id": 9, "x": 370, "y": 242.49, "label": "Br" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 2, "to": 7, "order": 1, "style": "wedge" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "striped" }, // OCH3 Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "wedge" }    // Br Wedge
        ]
      },
      { // Enantiomer B: OCH3 Wedge / Methyl Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "OCH3" }, { "id": 9, "x": 370, "y": 242.49, "label": "Br" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "striped" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "wedge" },   // OCH3 Wedge
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "striped" }  // Br Dash
        ]
      }
    ]
  },

  // --- 5. HYDROHALOGENATION ---
  // Markovnikov. Br to More Sub (C2). H to Less Sub.
  // Mixture of enantiomers. Br opposite to Methyl.
  {
    id: 5,
    title: "Hydrohalogenation",
    reagents: "HBr",
    description: "Markovnikov Addition (H to less sub, Br to more sub)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer B: Br Wedge / Methyl Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
                 { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
                 { "id": 3, "x": 300, "y": 242.49, "label": "" }, 
                 { "id": 4, "x": 240, "y": 277.13, "label": "" }, 
                 { "id": 5, "x": 180, "y": 242.49, "label": "" }, 
                 { "id": 6, "x": 180, "y": 173.21, "label": "" }, 
                 { "id": 7, "x": 350, "y": 138.56, "label": "" }, 
                 { "id": 8, "x": 370, "y": 173.21, "label": "Br" },
                 { "id": 9, "x": 370, "y": 242.49, "label": "H" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "striped" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "solid" },    // Br Wedge
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "solid" }    // H Dash
        ]
      }
    ]
  },

  // --- 6. CATALYTIC HYDRATION ---
  // Markovnikov. OH to More Sub (C2).
  // Mixture. OH opposite to Methyl.
  {
    id: 6,
    title: "Catalytic Hydration",
    reagents: "H₂O / H⁺",
    description: "Markovnikov Addition of Water (Alcohol product)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
          { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
          { "id": 3, "x": 300, "y": 242.49, "label": "" }, 
          { "id": 4, "x": 240, "y": 277.13, "label": "" }, 
          { "id": 5, "x": 180, "y": 242.49, "label": "" }, 
          { "id": 6, "x": 180, "y": 173.21, "label": "" }, 
          { "id": 7, "x": 350, "y": 138.56, "label": "" }, 
          { "id": 8, "x": 370, "y": 173.21, "label": "OH" },
          { "id": 9, "x": 370, "y": 242.49, "label": "H" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
          { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, 
          { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, 
          { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, 
          { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, 
          { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "solid" }, // OH Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "solid" } // H Dash
        ]
      }
    ]
  },

  // --- 7. ADDITION OF ALCOHOLS ---
  // Markovnikov. OCH3 to More Sub. Methyl opposite to OCH3.
  {
    id: 7,
    title: "Addition of Alcohols",
    reagents: "CH₃OH / H⁺",
    description: "Markovnikov Addition (Ether product)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
                 { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
                 { "id": 3, "x": 300, "y": 242.49, "label": "" }, 
                 { "id": 4, "x": 240, "y": 277.13, "label": "" }, 
                 { "id": 5, "x": 180, "y": 242.49, "label": "" }, 
                 { "id": 6, "x": 180, "y": 173.21, "label": "" }, 
                 { "id": 7, "x": 350, "y": 138.56, "label": "" }, 
                 { "id": 8, "x": 370, "y": 173.21, "label": "OCH3" },
                 { "id": 9, "x": 370, "y": 242.49, "label": "H" }, 
                ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
          { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, 
          { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, 
          { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, 
          { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, 
          { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "solid" },
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "solid" },
        ]
      },
    ]
  },

  // --- 8. OXYMERCURATION-REDUCTION ---
  // Anti addition (OH and H trans). OH on More Sub.
  // Methyl opposite to OH.
  {
    id: 8,
    title: "Oxymercuration-Reduction",
    reagents: "1. Hg(OAc)₂, H₂O / 2. NaBH₄",
    description: "Markovnikov Addition of OH (Anti-Addition)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: OH Dash / Methyl Wedge / H Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "OH" }, { "id": 9, "x": 370, "y": 242.49, "label": "H" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "solid" }, // OH Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "solid" }    // H Wedge
        ]
      },
    ]
  },

  // --- 9. ALKOXYMERCURATION-REDUCTION ---
  // Anti addition. OCH3 on More Sub. H on Less Sub.
  {
    id: 9,
    title: "Alkoxymercuration-Reduction",
    reagents: "1. Hg(OAc)₂, CH₃OH / 2. NaBH₄",
    description: "Markovnikov Addition of OCH3 (Anti-Addition)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: OCH3 Dash / Methyl Wedge / H Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
                 { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
                 { "id": 3, "x": 300, "y": 242.49, "label": "" }, 
                 { "id": 4, "x": 240, "y": 277.13, "label": "" }, 
                 { "id": 5, "x": 180, "y": 242.49, "label": "" }, 
                 { "id": 6, "x": 180, "y": 173.21, "label": "" }, 
                 { "id": 7, "x": 350, "y": 138.56, "label": "" }, 
                 { "id": 8, "x": 370, "y": 173.21, "label": "O" }, 
                 { "id": 9, "x": 370, "y": 242.49, "label": "H" },
                 { "id": 10, "x": 410, "y": 138.56, "label": "CH3" },
                ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
          { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, 
          { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, 
          { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, 
          { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, 
          { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "solid" }, // OCH3 Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "solid" },    // H Wedge
          { "id": 110, "from": 8, "to": 10, "order": 1, "style": "solid" } 
        ]
      },
      
    ]
  },

  // --- 10. HYDROBORATION-OXIDATION ---
  // Syn Addition. Anti-Markovnikov.
  // OH on Less Sub (C3). H on More Sub (C2).
  // Methyl opposite to H (on C2).
  {
    id: 10,
    title: "Hydroboration-Oxidation",
    reagents: "1. BH₃·THF / 2. H₂O₂, OH⁻",
    description: "Anti-Markovnikov, Syn Addition",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: H Wedge / Methyl Dash / OH Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "H" }, { "id": 9, "x": 370, "y": 242.49, "label": "OH" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 2, "to": 7, "order": 1, "style": "striped" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "wedge" },   // H Wedge
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "wedge" }    // OH Wedge
        ]
      },
      { // Enantiomer B: H Dash / Methyl Wedge / OH Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "H" }, { "id": 9, "x": 370, "y": 242.49, "label": "OH" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 2, "to": 7, "order": 1, "style": "wedge" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "striped" }, // H Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "striped" }  // OH Dash
        ]
      }
    ]
  },

  // --- 11. EPOXIDATION ---
  // Syn Addition. Oxygen adds to one face. Methyl pushed to opposite face.
  {
    id: 11,
    title: "Epoxidation",
    reagents: "mCPBA",
    description: "Syn Addition of Oxygen (Epoxide)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: Epoxide Wedges / Methyl Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 207.85, "label": "O" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "striped" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "wedge" },   // O Wedge
          { "id": 109, "from": 3, "to": 8, "order": 1, "style": "wedge" }    // O Wedge
        ]
      },
      { // Enantiomer B: Epoxide Dashes / Methyl Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 207.85, "label": "O" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 2, "to": 7, "order": 1, "style": "wedge" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "striped" }, // O Dash
          { "id": 109, "from": 3, "to": 8, "order": 1, "style": "striped" }  // O Dash
        ]
      }
    ]
  },

  // --- 12. OZONOLYSIS ---
  // Ring Opening. Methyl is now on a ketone carbonyl (sp2). Planar.
  // Solid line is correct here because there is no stereocenter at C=O.
  {
    id: 12,
    title: "Ozonolysis",
    reagents: "1. O₃ / 2. DMS",
    description: "Oxidative Cleavage (Ring opens to Keto-Aldehyde)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
               { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
               { "id": 3, "x": 300, "y": 242.49, "label": "" }, 
               { "id": 4, "x": 240, "y": 277.13, "label": "" }, 
               { "id": 5, "x": 180, "y": 242.49, "label": "" }, 
               { "id": 6, "x": 180, "y": 173.21, "label": "" }, 
               { "id": 7, "x": 350, "y": 138.56, "label": "CH3" },
               { "id": 8, "x": 350, "y": 277.13, "label": "H" }, 
              ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
               { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, 
               { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, 
               { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, 
               { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, 
               { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
               { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" },
               { "id": 108, "from": 8, "to": 3, "order": 1, "style": "solid" }, ]
    },
    solutions: [
      {
        atoms: [
          { "id": 1, "x": 100, "y": 200, "label": "" },
          { "id": 2, "x": 140, "y": 240, "label": "" },
          { "id": 3, "x": 180, "y": 200, "label": "" },
          { "id": 4, "x": 220, "y": 240, "label": "" },
          { "id": 5, "x": 260, "y": 200, "label": "" },
          { "id": 6, "x": 300, "y": 240, "label": "" }, 
          { "id": 7, "x": 340, "y": 280, "label": "O" }, // Aldehyde O
          { "id": 8, "x": 60, "y": 240, "label": "O" },  // Ketone O
          { "id": 9, "x": 100, "y": 160, "label": "" },  // Methyl group
        ],
        bonds: [
          { "id": 201, "from": 1, "to": 2, "order": 1, "style": "solid" },
          { "id": 202, "from": 2, "to": 3, "order": 1, "style": "solid" },
          { "id": 203, "from": 3, "to": 4, "order": 1, "style": "solid" },
          { "id": 204, "from": 4, "to": 5, "order": 1, "style": "solid" },
          { "id": 205, "from": 5, "to": 6, "order": 1, "style": "solid" },
          { "id": 206, "from": 6, "to": 7, "order": 2, "style": "solid" }, 
          { "id": 207, "from": 1, "to": 8, "order": 2, "style": "solid" }, 
          { "id": 208, "from": 1, "to": 9, "order": 1, "style": "solid" }  // Solid is correct for Methyl on C=O
        ]
      }
    ]
  },

  // --- 13. DIHYDROXYLATION ---
  // Syn Addition. Methyl pushed opposite to OH.
  {
    id: 13,
    title: "Dihydroxylation",
    reagents: "OsO₄ / NMO",
    description: "Syn Dihydroxylation (Two OH groups)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: OH Wedges / Methyl Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "OH" }, { "id": 9, "x": 370, "y": 242.49, "label": "OH" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "striped" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "wedge" },   // OH Wedge
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "wedge" }    // OH Wedge
        ]
      },
      { // Enantiomer B: OH Dashes / Methyl Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "OH" }, { "id": 9, "x": 370, "y": 242.49, "label": "OH" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 2, "to": 7, "order": 1, "style": "wedge" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "striped" }, // OH Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "striped" }  // OH Dash
        ]
      }
    ]
  },

  // --- 14. CYCLOPROPANATION ---
  // Syn Addition. CH2 adds to one face. Methyl pushed opposite.
  {
    id: 14,
    title: "Cyclopropanation",
    reagents: "CH₂I₂ / Zn(Cu)",
    description: "Syn Addition of CH2",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: CH2 Wedges / Methyl Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 207.85, "label": "CH2" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "striped" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "wedge" },   // C Wedge
          { "id": 109, "from": 3, "to": 8, "order": 1, "style": "wedge" }    // C Wedge
        ]
      },
      { // Enantiomer B: CH2 Dashes / Methyl Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 207.85, "label": "CH2" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "wedge" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "striped" }, // C Dash
          { "id": 109, "from": 3, "to": 8, "order": 1, "style": "striped" }  // C Dash
        ]
      }
    ]
  },

  // --- 15. RADICAL HYDROHALOGENATION ---
  // Anti-Markovnikov. H to More Sub (C2). Br to Less Sub (C3).
  // Mixture. H opposite to Methyl.
  {
    id: 15,
    title: "Radical Hydrohalogenation",
    reagents: "HBr / ROOR",
    description: "Anti-Markovnikov Hydrohalogenation (Mixture)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" } ],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 2, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" } ]
    },
    solutions: [
      { // Enantiomer A: H Wedge / Methyl Dash
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, { "id": 2, "x": 300, "y": 173.21, "label": "" }, { "id": 3, "x": 300, "y": 242.49, "label": "" }, { "id": 4, "x": 240, "y": 277.13, "label": "" }, { "id": 5, "x": 180, "y": 242.49, "label": "" }, { "id": 6, "x": 180, "y": 173.21, "label": "" }, { "id": 7, "x": 350, "y": 138.56, "label": "" }, { "id": 8, "x": 370, "y": 173.21, "label": "H" }, { "id": 9, "x": 370, "y": 242.49, "label": "Br" } ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" }, // Methyl Dash
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "solid" },   // H Wedge
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "solid" }    // Br Wedge (Can be mixture but usually drawn Anti to H in some texts, sticking to mixture logic of H setting stereocenter)
        ]
      },
    ]
  },

  // --- 16. HYDROHALOGENATION ---
  // Markovnikov. Br to More Sub (C2). H to Less Sub.
  // Mixture of enantiomers. Br opposite to Methyl.
  {
    id: 16,
    title: "Hydrohalogenation",
    reagents: "HBr",
    description: "Markovnikov Addition (H to less sub, Br to more sub)",
    question:
    { freePosition: true, // Pentagon with 2 C substituents - don't snap to hex grid
      atoms: [
        { "id": 1, "x": 250, "y": 140, "label": "" },
        { "id": 2, "x": 307, "y": 182, "label": "" },
        { "id": 3, "x": 285, "y": 249, "label": "" },
        { "id": 4, "x": 215, "y": 249, "label": "" },
        { "id": 5, "x": 193, "y": 182, "label": "" },
        { "id": 6, "x": 380, "y": 145, "label": "" },
        { "id": 7, "x": 355, "y": 105, "label": "" },
        { "id": 8, "x": 460, "y": 182, "label": "" }
      ],
      bonds: [
        { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" },
        { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" },
        { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" },
        { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" },
        { "id": 105, "from": 5, "to": 1, "order": 1, "style": "solid" },
        { "id": 106, "from": 2, "to": 6, "order": 1, "style": "solid" },
        { "id": 107, "from": 2, "to": 7, "order": 1, "style": "solid" },
        { "id": 108, "from": 6, "to": 8, "order": 2, "style": "solid" }
      ]
    },
    solutions: [
      { // Enantiomer A: Br Dash / Methyl Wedge
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
                 { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
                 { "id": 3, "x": 300, "y": 242.49, "label": "" }, 
                 { "id": 4, "x": 240, "y": 277.13, "label": "" }, 
                 { "id": 5, "x": 180, "y": 242.49, "label": "" }, 
                 { "id": 6, "x": 180, "y": 173.21, "label": "" }, 
                 { "id": 7, "x": 350, "y": 138.56, "label": "" }, 
                 { "id": 8, "x": 370, "y": 173.21, "label": "Br" },
                 { "id": 9, "x": 370, "y": 242.49, "label": "" }  
                ],
        bonds: [
          { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
          { "id": 102, "from": 2, "to": 3, "order": 1, "style": "solid" }, 
          { "id": 103, "from": 3, "to": 4, "order": 1, "style": "solid" }, 
          { "id": 104, "from": 4, "to": 5, "order": 1, "style": "solid" }, 
          { "id": 105, "from": 5, "to": 6, "order": 1, "style": "solid" }, 
          { "id": 106, "from": 6, "to": 1, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" }, 
          { "id": 107, "from": 7, "to": 2, "order": 1, "style": "solid" },   // Methyl Wedge
          { "id": 108, "from": 2, "to": 8, "order": 1, "style": "solid" }, // Br Dash
          { "id": 109, "from": 3, "to": 9, "order": 1, "style": "solid" },
        ]
      },

      
    ]
  },


  {
    id: 17,
    title: "Catalytic Hydration",
    reagents: "H₂O / H⁺",
    description: "Markovnikov Addition of Water (Alcohol product)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
        { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
        { "id": 3, "x": 200, "y": 69.28, "label": "" },
        { "id": 6, "x": 180, "y": 173.21, "label": "" },
        { "id": 7, "x": 360, "y": 138.56, "label": "" }],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
               { "id": 102, "from": 1, "to": 6, "order": 1, "style": "solid" }, 
               { "id": 103, "from": 2, "to": 7, "order": 2, "style": "solid" },
               { "id": 105, "from": 3, "to": 1, "order": 1, "style": "solid" }]
    },
    solutions: [{
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
        { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
        { "id": 3, "x": 200, "y": 69.28, "label": "" }, 
        { "id": 4, "x": 280, "y": 69.28, "label": "OH" }, 
        { "id": 5, "x": 420, "y": 173.21, "label": "H" }, 
        { "id": 6, "x": 180, "y": 173.21, "label": "" }, 
        { "id": 7, "x": 360, "y": 138.56, "label": "" }],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
               { "id": 102, "from": 1, "to": 6, "order": 1, "style": "solid" }, 
               { "id": 103, "from": 2, "to": 7, "order": 1, "style": "solid" },
               { "id": 104, "from": 1, "to": 3, "order": 1, "style": "solid" },
               { "id": 105, "from": 1, "to": 4, "order": 1, "style": "solid" },
               { "id": 106, "from": 5, "to": 7, "order": 1, "style": "solid" },
         ]
        }]
      },
    

  {
    id: 18,
    title: "Addition of Alcohols",
    reagents: "CH₃OH / H⁺",
    description: "Markovnikov Addition (Ether product)",
    question: {
      atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
        { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
        { "id": 3, "x": 260, "y": 242.49, "label": "" },
        { "id": 4, "x": 340, "y": 242.49, "label": "" },
        { "id": 6, "x": 180, "y": 173.21, "label": "" },
        { "id": 7, "x": 360, "y": 138.56, "label": "" }],
      bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
               { "id": 102, "from": 1, "to": 6, "order": 2, "style": "solid" }, 
               { "id": 103, "from": 2, "to": 7, "order": 1, "style": "solid" },
               { "id": 104, "from": 4, "to": 2, "order": 1, "style": "solid" },
               { "id": 105, "from": 3, "to": 2, "order": 1, "style": "solid" }]
    },
    solutions: [
      {
        atoms: [ { "id": 1, "x": 240, "y": 138.56, "label": "" }, 
          { "id": 2, "x": 300, "y": 173.21, "label": "" }, 
          { "id": 3, "x": 260, "y": 242.49, "label": "" },
          { "id": 4, "x": 340, "y": 242.49, "label": "OCH3" },
          { "id": 5, "x": 180, "y": 242.49, "label": "H" },
          { "id": 6, "x": 180, "y": 173.21, "label": "" },
          { "id": 7, "x": 360, "y": 138.56, "label": "" },
          { "id": 8, "x": 240, "y": 69.28, "label": "" },  
        ],
        bonds: [ { "id": 101, "from": 1, "to": 2, "order": 1, "style": "solid" }, 
                 { "id": 102, "from": 1, "to": 6, "order": 1, "style": "solid" }, 
                 { "id": 103, "from": 2, "to": 7, "order": 1, "style": "solid" },
                 { "id": 104, "from": 4, "to": 2, "order": 1, "style": "solid" },
                 { "id": 105, "from": 3, "to": 2, "order": 1, "style": "solid" },
                 { "id": 106, "from": 5, "to": 6, "order": 1, "style": "solid" },
                 { "id": 107, "from": 1, "to": 8, "order": 1, "style": "solid" },
                ]
      
        }
      ]
  },
];