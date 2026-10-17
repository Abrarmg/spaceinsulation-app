// Standard customer-facing descriptions for common services. Used to pre-fill line items in
// the estimate builder and as a fallback on estimate documents when an item has no description.
// Order matters: more specific entries must come before broader ones.

export interface ServiceDescription {
  name: string;
  match: RegExp;
  description: string;
}

export const SERVICE_DESCRIPTIONS: ServiceDescription[] = [
  {
    name: 'Insulation Removal',
    match: /\b(remov|vacuum|take out|strip out)\w*.*insulation|insulation.*\b(remov|vacuum)/i,
    description:
      'Remove and dispose of the existing attic insulation, including any damaged, compressed or contaminated material, leaving a clean attic ready for new insulation.',
  },
  {
    name: 'Mold Removal & Treatment',
    match: /mou?ld/i,
    description:
      'Treat affected attic sheathing and framing with an anti-microbial solution to remove mold growth and help prevent it from returning.',
  },
  {
    name: 'Blown-In Attic Insulation',
    match: /blow|attic insulation|\bR-?\s?(40|50|60)\b/i,
    description:
      'Install new blown-in insulation evenly across the attic floor to the R-value shown, reducing heat loss in winter and heat gain in summer for lower energy bills and more even room temperatures.',
  },
  {
    name: 'Batt Insulation',
    match: /\bbatt/i,
    description:
      'Install fitted batt insulation in the specified area to fill gaps in the existing coverage and improve the thermal barrier.',
  },
  {
    name: 'Spray Foam Insulation',
    match: /spray\s*foam/i,
    description:
      'Apply spray foam to seal and insulate the specified area, closing gaps that let warm or cold air and moisture through.',
  },
  {
    name: 'Air Sealing',
    match: /air\s*seal/i,
    description:
      'Seal gaps and openings between the living space and the attic (around light fixtures, pipes, wiring and top plates) to stop warm, moist air leaking into the attic. This reduces drafts, energy loss and the risk of condensation.',
  },
  {
    name: 'Baffle Installation',
    match: /baffle|rafter vent/i,
    description:
      'Install ventilation baffles at the roof edges to keep insulation from blocking the soffit vents, so the attic can breathe and stays dry.',
  },
  {
    name: 'Soffit & Fascia Replacement',
    match: /soffit|fascia/i,
    description:
      'Replace the damaged soffit and fascia along the roof edge. Vented soffit lets fresh air into the attic, which helps control moisture and protects the roof.',
  },
  {
    name: 'Bathroom Fan Duct',
    match: /(bath(room)?|exhaust).*(fan|vent|pipe|duct)|(fan|vent).*(pipe|duct)/i,
    description:
      'Replace or reconnect the bathroom exhaust fan duct with insulated ducting vented to the exterior, so humid air leaves the home instead of collecting in the attic and causing condensation or mold.',
  },
  {
    name: 'Attic Hatch Box Repair',
    match: /hatch.*(box|repair|frame)|(box|repair).*hatch/i,
    description:
      'Repair or rebuild the frame around the attic hatch so the cover sits flat and closes properly, and to hold back the surrounding insulation.',
  },
  {
    name: 'Attic Hatch / Door Insulation',
    match: /(attic|hatch).*(door|hatch|cover)|hatch/i,
    description:
      'Insulate the attic access door or hatch cover so it matches the rest of the attic and is no longer a weak spot for heat loss.',
  },
  {
    name: 'Weather Stripping',
    match: /weather\s*strip/i,
    description:
      'Install weather stripping around the attic access opening to create an airtight seal when closed, preventing drafts and warm air escaping into the attic.',
  },
  {
    name: 'Roof Vent Installation',
    match: /roof vent|attic vent|ventilation/i,
    description:
      'Install additional roof vents to improve attic airflow, helping remove heat in summer and moisture in winter.',
  },
  {
    name: 'Garage Insulation',
    match: /garage/i,
    description:
      'Insulate the specified garage walls or ceiling to reduce heat loss to and from the garage, especially beneath or beside living spaces.',
  },
  {
    name: 'Wall Insulation',
    match: /wall/i,
    description:
      'Insulate the specified wall cavities to improve comfort and reduce heat loss through exterior walls.',
  },
  {
    name: 'Basement Insulation',
    match: /basement/i,
    description:
      'Insulate the basement walls to reduce heat loss through the foundation and make the space warmer and more comfortable.',
  },
  {
    name: 'Crawl Space Insulation',
    match: /crawl/i,
    description:
      'Insulate and seal the crawl space to reduce cold floors, drafts and moisture coming up into the home.',
  },
  {
    name: 'Vapour Barrier',
    match: /vapou?r/i,
    description:
      'Install a vapour barrier to stop moisture from moving into the insulation and building structure.',
  },
];

export const findServiceDescription = (name: string | null | undefined): string | null => {
  const text = (name || '').trim();
  if (!text) return null;
  return SERVICE_DESCRIPTIONS.find(s => s.match.test(text))?.description ?? null;
};
