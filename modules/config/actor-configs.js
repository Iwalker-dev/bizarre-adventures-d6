// systems/bizarre-adventures-d6/scripts/sheets/type-configs.js

export const typeConfigs = {
  user: {
    Natural: {
      label: "Natural User",
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          rows:        2,
          placeholder: "Describe your natural talents",
          description: "A Natural-born stand user, drawn by fate for a mysterious purpose."
        }
      ]
    },
    Freak: {
      label: "Freak",
      cost: "1-3 User Points",
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          input:       "textarea",
          rows:        3,
          description: `
            • Someone with anomalous powers that defy explanation, not tied to a Power Source.
            • Traits that are just strange do not need to be paid for, they can be included in a Bio.
            • Ex. Bruford's Danse Macab-Hair, Mrs. Robinson's bugs, Diavolo's dual souls.
          `
        }
      ]
    },
    Ghost: {
      label: "Ghost",
      cost: "2 User Points",
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          rows:        3,
          description: `
            • A spirit of the dead, tied to the mortal world by an unfulfilled purpose.
            • They typically keep whatever injury caused their death as a Mark.
            • Ghosts must follow certain Rules.
            -Ghosts are on the same level of selective intangibility as Stands.
            -Animals and Stand Users can see Ghosts.
            -Ghosts cannot be seen by normal people, but can make themselves heard.
            -If a Ghost’s limb unwillingly touches a living thing, it is severed but not lost.
            -Normal objects may be manipulated as normal, but not felt by the ghost.
            -When any object is destroyed, its previous form becomes a Ghost Object.
            -Ghost Objects can be used by Ghosts, and only affect other non-living spirits.
            -Ghosts may only enter a room if let inside, or it is empty.
          `
        }
      ]
    },
    Alien: {
      label: "Alien",
      cost: "2 User Points",
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          rows:        3,
          description: `
            • A shapeshifting extraterrestrial, hailing from the Magellanic Clouds and lost on Earth.
            -
            • These beings can Shapeshift into any non-complex object, of equal or lesser mass.
            • Aliens have a Sensitivity to high-pitched sounds, and take a Hit on exposure.
            • While exposed to sound, the alien’s form will be unstable, and change rapidly.
            -
            • Aliens may also have access to foreign technologies and weapons based on setting.
            • This section is made under the assumption that Mikitaka is not a Stand User.
          `
        }
      ]
    },
    Rock: {
      label: "Rock Human",
      cost: "1 User Point",
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          rows:        3,
          description: `
            A counterpart to Homo Sapiens, in tune with nature and attracted to ‘sacred ground’.
            Rock Form is used for months-long hibernation, resisting extreme conditions.
            After hibernating, the Rock Human can stay awake for an equal amount of time.

            They all have a mango allergy, and despite being Silicon-based can eat a paleo diet.
            Due to their Incubation, they lack legal identities, prosocial emotions, and childhoods.
            
            All Rock Organisms can turn parts of their body into a chosen Material.
            Rock Animals/Insects are known to Masquerade as human-made objects.
            Rock Humans are more sophisticated at this, opting for identity theft and fake jobs.
          `
        }
      ]
    },
        Pillar: {
      label: "Pillar Man",
      cost: "4 User/4 Stand, Vampire, GM Approval",
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          input:       "textarea",
          rows:        3,
          placeholder: "Summary of anomalous powers",
          description: `
            • A mesoamerican ultra-vampire, horned apex predators from a bygone era.
            -
            • Higher Being grants double the organ systems from Range ranks, and superior minds.
            • The first User Stat roll has double dice, A Power B/Wit A roll would be 14d6 in total.
            • A Pillar Man that hasn’t used a Stone Mask still ages, but lives for thousands of years.
            • Rock Form can negate instant death from Hamon/Sun exposure, and help hibernate.
            -
            • After using a Stone Mask, a Pillar Man’s innate vampirism and hunger increase greatly.
            • Superhuman Body lets Pillar Men rearrange their bodies or others at will.
            • Absorption upgrades Blood Sucking, assimilating live victims on any physical contact.
            • Functions evolve into Modes based on an element.
            • Vampirification - Creates Vampires with Learning, all Abilities, and (Ranks * 5) Points.
          `
        }
      ]
    },
    // …other user types…
  },

  stand: {
    Natural: {
      label: "Natural Stand",
      fields: [
        { key: "manifestation", label: "Manifestation", input: "textarea", rows: 2, placeholder: "How it appears", description: "The initial form your Stand takes." },
        { key: "boundRange",    label: "Bound Range",    input: "text",     placeholder: "e.g. 10m",       description: "How far you can stray from your master." }
      ]
    },
    Artificial: {
      label: "Artificial Stand",
      fields: [
        { key: "origin",   label: "Origin",   input: "textarea", rows: 2, placeholder: "How it was made", description: "The circumstances of its creation." },
        { key: "material", label: "Material", input: "text",     placeholder: "e.g. Mechanical", description: "What it’s physically composed of." }
      ]
    },
    // …other stand types…
  },

  power: {
    Hamon: {
      label: "Hamon Warrior",
      fields: [
        { key: "abilities", label: "Abilities", input: "textarea", rows: 2, placeholder: "Describe your power", description: "Incomplete." }
      ]
    },
    Vampire: {
      label: "Vampire",
      fields: [
        { key: "abilities", label: "Abilities", input: "textarea", rows: 2, placeholder: "How it was created", description: "Details on how this power was artificially created." }
      ]
    },
    Spin: {
      label: "Spin",
      fields: [
        { key: "abilities", label: "abilities", input: "textarea", rows: 2, placeholder: "How it was created", description: "Details on how this power was artificially created." }
      ]
    },
    Armed: {
      label: "Armed Phenomenon",
      fields: [
        { key: "abilities", label: "abilities", input: "textarea", rows: 2, placeholder: "How it was created", description: "Details on how this power was artificially created." }
      ]
    },
    Cyborg: {
      label: "Cyborg",
      fields: [
        { key: "abilities", label: "abilities", input: "textarea", rows: 2, placeholder: "How it was created", description: "Details on how this power was artificially created." }
      ]
    },
    // …other power types…
  }
};
