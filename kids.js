'use strict';
// Kids: Bible stories told in short animated scenes, with a lamb called Qali (ቃሊ) as the guide.
// Every drawing here is original, made of simple shapes; scenes are composed from these pieces.
// A scene is 400 × 260 units. Each piece is drawn around its own origin: people and animals stand on it.

const KS = {}; // sprite makers: name -> (options) => SVG markup

const SKIN = ['#8D5A3B', '#A86B47', '#6E4430', '#C68A5E'];

// A person: robe colour, skin, hair; options for a beard, a head scarf, a crown, wings and a halo, and poses.
KS.person = (o = {}) => {
  const skin = o.skin || SKIN[0], robe = o.robe || '#EF3340', hair = o.hair || '#2B1B12', sash = o.sash || 'rgba(255,255,255,.35)';
  const pose = o.pose || 'stand';
  const arm = (side) => {
    const x = side < 0 ? -21 : 15;
    if (pose === 'up') return `<rect x="${side < 0 ? -25 : 19}" y="-66" width="7" height="26" rx="3.5" fill="${robe}" transform="rotate(${side * -18} ${side < 0 ? -21 : 22} -40)"/><circle cx="${side < 0 ? -27 : 27}" cy="-66" r="4" fill="${skin}"/>`;
    if (pose === 'pray') return side < 0 ? `<path d="M-14 -34 L-3 -46 L-1 -42 L-10 -30 Z" fill="${robe}"/><path d="M14 -34 L3 -46 L1 -42 L10 -30 Z" fill="${robe}"/><ellipse cx="0" cy="-46" rx="3" ry="5" fill="${skin}"/>` : '';
    if (pose === 'hold') return side < 0 ? `<rect x="-21" y="-36" width="7" height="22" rx="3.5" fill="${robe}"/><circle cx="-17.5" cy="-13" r="3.6" fill="${skin}"/>` : `<rect x="14" y="-40" width="7" height="18" rx="3.5" fill="${robe}" transform="rotate(-60 17 -40)"/><circle cx="31" cy="-44" r="3.6" fill="${skin}"/>`;
    return `<rect x="${x}" y="-36" width="7" height="22" rx="3.5" fill="${robe}"/><circle cx="${x + 3.5}" cy="-13" r="3.6" fill="${skin}"/>`;
  };
  const eyes = o.eyes === 'closed'
    ? `<path d="M-6.5 -51 q2.5 2 5 0 M1.5 -51 q2.5 2 5 0" stroke="#2B1B12" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    : `<circle cx="-4.2" cy="-51" r="1.9" fill="#1A120D"/><circle cx="4.2" cy="-51" r="1.9" fill="#1A120D"/><circle cx="-3.6" cy="-51.7" r=".6" fill="#fff"/><circle cx="4.8" cy="-51.7" r=".6" fill="#fff"/>`;
  const mouth = o.mood === 'scared' ? `<ellipse cx="0" cy="-44.5" rx="2" ry="2.6" fill="#5A2A1A"/>` : o.mood === 'sad' ? `<path d="M-3.5 -43.5 q3.5 -3 7 0" stroke="#5A2A1A" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : `<path d="M-4 -45.5 q4 3.8 8 0" stroke="#5A2A1A" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  return `<g>
${o.wings ? `<path d="M-6 -40 C-40 -62 -46 -20 -12 -18 Z M6 -40 C40 -62 46 -20 12 -18 Z" fill="#FFFFFF" opacity=".95"/>` : ''}
<ellipse cx="0" cy="1" rx="17" ry="3.5" fill="rgba(0,0,0,.15)"/>
${arm(-1)}${arm(1)}
<path d="M-16 0 L-12 -38 Q0 -46 12 -38 L16 0 Z" fill="${robe}"/>
<path d="M-12 -38 Q0 -46 12 -38 L10 -33 Q0 -39 -10 -33 Z" fill="${sash}"/>
<circle cx="0" cy="-50" r="12" fill="${skin}"/>
${o.scarf ? `<path d="M-14 -47 C-16 -66 16 -66 14 -47 L15 -36 L10 -38 L10 -50 C8 -60 -8 -60 -10 -50 L-10 -38 L-15 -36 Z" fill="${o.scarf}"/>` : `<path d="M-12.5 -52 a12.5 12.5 0 0 1 25 0 q-6 -4 -12.5 -2 q-6.5 -2 -12.5 2z" fill="${hair}"/>`}
${o.beard ? `<path d="M-11 -48 Q-10 -33 0 -32 Q10 -33 11 -48 Q6 -42 0 -42 Q-6 -42 -11 -48Z" fill="${o.beard}"/>` : ''}
${eyes}${o.beard ? '' : `<circle cx="-7.5" cy="-46.5" r="2.2" fill="#E07A6A" opacity=".45"/><circle cx="7.5" cy="-46.5" r="2.2" fill="#E07A6A" opacity=".45"/>`}${mouth}
${o.crown ? `<path d="M-9 -60 L-9 -70 L-4.5 -65 L0 -72 L4.5 -65 L9 -70 L9 -60 Z" fill="#F5C04A" stroke="#D99A12" stroke-width="1"/>` : ''}
${o.halo ? `<ellipse cx="0" cy="-67" rx="10" ry="3" fill="none" stroke="#F5C04A" stroke-width="2.4"/>` : ''}
${o.staff ? `<path d="M24 -70 L24 2" stroke="#8A5A2B" stroke-width="3.2" stroke-linecap="round"/><path d="M24 -70 q8 -2 7 6" stroke="#8A5A2B" stroke-width="3.2" fill="none" stroke-linecap="round"/>` : ''}
</g>`;
};
KS.baby = () => `<g><ellipse cx="0" cy="-6" rx="14" ry="7" fill="#FFF4E0"/><circle cx="-9" cy="-10" r="6.5" fill="${SKIN[3]}"/><path d="M-14.5 -12 a6 6 0 0 1 11 -2" fill="#2B1B12"/><path d="M-11 -10 q1 1 2 0 M-7.5 -10 q1 1 2 0" stroke="#2B1B12" stroke-width="1" fill="none"/></g>`;

// Qali, the lamb who tells the stories.
KS.qali = (o = {}) => `<g>
<ellipse cx="0" cy="2" rx="22" ry="4" fill="rgba(0,0,0,.15)"/>
<rect x="-14" y="-12" width="6" height="14" rx="3" fill="#3A2A24"/><rect x="8" y="-12" width="6" height="14" rx="3" fill="#3A2A24"/>
<g fill="#FFFFFF" stroke="#EADFD6" stroke-width="1.2"><circle cx="-14" cy="-22" r="11"/><circle cx="0" cy="-26" r="13"/><circle cx="14" cy="-22" r="11"/><circle cx="-6" cy="-14" r="10"/><circle cx="8" cy="-14" r="10"/></g>
<g class="${o.nod ? 'k-nod' : ''}"><ellipse cx="18" cy="-38" rx="12" ry="13" fill="#4A3631"/>
<ellipse cx="7" cy="-44" rx="7" ry="3.6" fill="#4A3631" transform="rotate(-25 7 -44)"/><ellipse cx="29" cy="-44" rx="7" ry="3.6" fill="#4A3631" transform="rotate(25 29 -44)"/>
<g fill="#FFFFFF" stroke="#EADFD6"><circle cx="13" cy="-50" r="5"/><circle cx="19" cy="-52" r="5.5"/><circle cx="25" cy="-50" r="5"/></g>
${o.happy ? `<path d="M11 -39 q3 -3 6 0 M20 -39 q3 -3 6 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>` : `<circle cx="14" cy="-39" r="2.6" fill="#fff"/><circle cx="23" cy="-39" r="2.6" fill="#fff"/><circle cx="14.6" cy="-39" r="1.4" fill="#111"/><circle cx="23.6" cy="-39" r="1.4" fill="#111"/>`}
<path d="M15 -31 q3.5 3 7 0" stroke="#FFB3BA" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="10" cy="-33" r="2" fill="#EF3340" opacity=".5"/><circle cx="27" cy="-33" r="2" fill="#EF3340" opacity=".5"/></g>
<path d="M6 -27 q8 4 16 -2" stroke="#EF3340" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="14" cy="-23" r="3.4" fill="#F5C04A" stroke="#D99A12" stroke-width="1"/>
</g>`;

KS.sheep = (o = {}) => `<g transform="scale(${o.flip ? -1 : 1} 1)">
<ellipse cx="0" cy="1" rx="16" ry="3" fill="rgba(0,0,0,.13)"/>
<rect x="-10" y="-9" width="4" height="10" rx="2" fill="#3A2A24"/><rect x="6" y="-9" width="4" height="10" rx="2" fill="#3A2A24"/>
<g fill="#FFFFFF" stroke="#E5DCD3"><circle cx="-8" cy="-15" r="8"/><circle cx="2" cy="-18" r="9"/><circle cx="10" cy="-13" r="7"/><circle cx="-2" cy="-9" r="7"/></g>
<ellipse cx="14" cy="-22" rx="6" ry="7" fill="#3A2A24"/><circle cx="16" cy="-23" r="1.3" fill="#fff"/>
</g>`;
KS.lion = (o = {}) => `<g transform="scale(${o.flip ? -1 : 1} 1)">
<ellipse cx="0" cy="1" rx="28" ry="4" fill="rgba(0,0,0,.15)"/>
<ellipse cx="-6" cy="-14" rx="22" ry="13" fill="#E8A548"/>
<rect x="-22" y="-8" width="7" height="10" rx="3" fill="#D99135"/><rect x="2" y="-8" width="7" height="10" rx="3" fill="#D99135"/>
<path d="M-27 -18 q-10 -2 -10 -12" stroke="#E8A548" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="-37" cy="-31" r="3" fill="#A8561E"/>
<circle cx="14" cy="-28" r="17" fill="#A8561E"/>
<circle cx="14" cy="-28" r="11.5" fill="#F5C26B"/>
${o.sleepy ? `<path d="M8 -30 q2.5 2 5 0 M16 -30 q2.5 2 5 0" stroke="#3A1F0E" stroke-width="1.6" fill="none" stroke-linecap="round"/><text x="30" y="-44" font-size="11" fill="#fff" font-family="sans-serif" font-weight="700">z</text><text x="37" y="-53" font-size="8" fill="#fff" font-family="sans-serif" font-weight="700">z</text>` : `<circle cx="10" cy="-30" r="1.8" fill="#3A1F0E"/><circle cx="18" cy="-30" r="1.8" fill="#3A1F0E"/>`}
<path d="M12 -25 h4 l-2 2.5z" fill="#3A1F0E"/><path d="M11 -21.5 q3 2.5 6 0" stroke="#3A1F0E" stroke-width="1.3" fill="none"/>
</g>`;
KS.fish = (o = {}) => `<g transform="scale(${o.flip ? -1 : 1} 1)"><path d="M-14 0 L-22 -7 L-22 7 Z" fill="${o.c || '#FF8A3D'}"/><ellipse cx="0" cy="0" rx="14" ry="8" fill="${o.c || '#FF8A3D'}"/><circle cx="7" cy="-2" r="1.8" fill="#111"/><path d="M-3 -6 q3 6 0 12" stroke="rgba(255,255,255,.5)" stroke-width="1.5" fill="none"/></g>`;
KS.bigfish = () => `<g>
<path d="M-70 0 L-102 -30 L-96 0 L-102 30 Z" fill="#3E8FB0"/>
<ellipse cx="0" cy="0" rx="76" ry="44" fill="#4FA8C9"/>
<path d="M-60 12 Q0 48 60 12 Q0 34 -60 12Z" fill="#BDE6F2"/>
<path d="M-10 -40 q12 -20 26 -4" fill="#3E8FB0"/>
<circle cx="40" cy="-14" r="8" fill="#fff"/><circle cx="42" cy="-14" r="4.2" fill="#11303B"/>
<path d="M58 6 q10 4 16 -2" stroke="#11303B" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="-20" cy="-8" r="5" fill="#BDE6F2" opacity=".5"/><circle cx="-36" cy="4" r="4" fill="#BDE6F2" opacity=".5"/>
</g>`;
KS.dove = (o = {}) => `<g><ellipse cx="0" cy="0" rx="13" ry="7" fill="#FFFFFF"/><circle cx="11" cy="-4" r="5.5" fill="#FFFFFF"/><path d="M16 -4 l5 1 l-5 2z" fill="#F5A623"/><circle cx="12" cy="-5" r="1" fill="#111"/>
<path class="k-flap" d="M-2 -2 Q-8 -22 6 -18 Q4 -8 -2 -2Z" fill="#EEF4F8"/><path d="M-13 0 l-9 -4 l2 6 l-2 5 z" fill="#FFFFFF"/>
${o.leaf ? `<path d="M20 -2 q8 -6 12 0 q-6 5 -12 0z" fill="#5BAE5B"/>` : ''}</g>`;
KS.sun = () => `<g><g class="k-spin">${Array.from({ length: 12 }, (_, i) => `<rect x="-2" y="-40" width="4" height="12" rx="2" fill="#FFC93C" transform="rotate(${i * 30})"/>`).join('')}</g><circle r="22" fill="#FFD54A"/><circle cx="-7" cy="-4" r="2.2" fill="#8A5A00"/><circle cx="7" cy="-4" r="2.2" fill="#8A5A00"/><path d="M-7 5 q7 6 14 0" stroke="#8A5A00" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="-12" cy="3" r="3" fill="#FF8A65" opacity=".5"/><circle cx="12" cy="3" r="3" fill="#FF8A65" opacity=".5"/></g>`;
KS.moon = () => `<g><path d="M6 -20 A20 20 0 1 0 6 20 A15 15 0 1 1 6 -20Z" fill="#FFF3C4"/></g>`;
KS.star = (o = {}) => `<path d="M0 -${o.r || 8} L${(o.r || 8) * .29} -${(o.r || 8) * .4} L${o.r || 8} -${(o.r || 8) * .31} L${(o.r || 8) * .47} ${(o.r || 8) * .15} L${(o.r || 8) * .59} ${(o.r || 8) * .81} L0 ${(o.r || 8) * .5} L-${(o.r || 8) * .59} ${(o.r || 8) * .81} L-${(o.r || 8) * .47} ${(o.r || 8) * .15} L-${o.r || 8} -${(o.r || 8) * .31} L-${(o.r || 8) * .29} -${(o.r || 8) * .4} Z" fill="${o.c || '#FFE27A'}"/>`;
KS.cloud = (o = {}) => `<g fill="${o.dark ? '#7A8391' : '#FFFFFF'}" opacity="${o.dark ? 1 : .95}"><circle cx="-18" cy="0" r="13"/><circle cx="0" cy="-8" r="17"/><circle cx="19" cy="0" r="13"/><rect x="-30" y="0" width="60" height="12" rx="6"/></g>`;
KS.rain = () => `<g class="k-rain" stroke="#9FD3F0" stroke-width="2.5" stroke-linecap="round">${Array.from({ length: 9 }, (_, i) => `<path d="M${-40 + i * 10} ${(i % 3) * 8} l-4 12"/>`).join('')}</g>`;
KS.waves = (o = {}) => `<g class="k-wave"><path d="M-320 0 ${Array.from({ length: 20 }, (_, i) => `q20 ${o.big ? -16 : -8} 40 0`).join(' ')} V140 H-320Z" fill="${o.c || '#3FA2D9'}"/></g>`;
KS.hills = (o = {}) => `<g><path d="M-220 0 Q-140 -50 -60 -6 Q20 -60 110 -8 Q170 -44 230 -4 V40 H-220Z" fill="${o.c || '#6CC46B'}"/></g>`;
KS.tree = () => `<g><rect x="-5" y="-30" width="10" height="30" rx="3" fill="#8A5A2B"/><circle cx="0" cy="-44" r="20" fill="#4CAF50"/><circle cx="-14" cy="-34" r="12" fill="#5DBB5C"/><circle cx="14" cy="-34" r="12" fill="#43A047"/><circle cx="6" cy="-50" r="3" fill="#EF3340"/><circle cx="-8" cy="-42" r="3" fill="#EF3340"/></g>`;
KS.flower = (o = {}) => `<g><path d="M0 0 V-16" stroke="#3E9B3E" stroke-width="2.4"/><g fill="${o.c || '#FF6B8B'}">${[0, 72, 144, 216, 288].map((a) => `<circle cx="0" cy="-22" r="4.5" transform="rotate(${a} 0 -16)"/>`).join('')}</g><circle cx="0" cy="-16" r="3.2" fill="#FFD54A"/></g>`;
KS.palm = () => `<g><path d="M0 0 Q-4 -30 2 -56" stroke="#8A5A2B" stroke-width="7" fill="none" stroke-linecap="round"/><g fill="#43A047"><path d="M2 -56 Q-24 -66 -34 -48 Q-16 -58 2 -56Z"/><path d="M2 -56 Q28 -68 36 -46 Q18 -58 2 -56Z"/><path d="M2 -56 Q-10 -80 -26 -76 Q-8 -70 2 -56Z"/><path d="M2 -56 Q16 -82 30 -74 Q12 -70 2 -56Z"/></g></g>`;
KS.ark = (o = {}) => `<g><path d="M-80 -20 L80 -20 L64 14 Q0 26 -64 14 Z" fill="#9C6234"/><path d="M-72 -10 H72 M-68 2 H68" stroke="#7A4A22" stroke-width="2.4"/>
<rect x="-44" y="-52" width="88" height="32" rx="4" fill="#C08552"/><path d="M-52 -50 L0 -74 L52 -50Z" fill="#8C4F23"/>
<rect x="-30" y="-44" width="14" height="12" rx="2" fill="#5A3416"/><rect x="16" y="-44" width="14" height="12" rx="2" fill="#5A3416"/>
${o.peek ? `<g transform="translate(-23 -34) scale(.42)">${KS.sheep()}</g><g transform="translate(24 -32) scale(.36)"><circle cx="0" cy="-20" r="11" fill="#F5C26B"/><circle cx="-4" cy="-22" r="1.6" fill="#3A1F0E"/><circle cx="4" cy="-22" r="1.6" fill="#3A1F0E"/></g>` : ''}</g>`;
KS.boat = (o = {}) => `<g><path d="M-46 -10 L46 -10 L34 10 Q0 16 -34 10 Z" fill="#B5703A"/><path d="M0 -10 V-70" stroke="#7A4A22" stroke-width="3.5"/>${o.sail === false ? '' : `<path d="M2 -66 Q34 -40 2 -16 Z" fill="#FFF8EE"/>`}</g>`;
KS.basket = (o = {}) => `<g><ellipse cx="0" cy="0" rx="22" ry="9" fill="#C8924B"/><path d="M-21 -2 Q0 12 21 -2" stroke="#9C6234" stroke-width="2" fill="none"/><path d="M-16 -4 v8 M-8 -5 v10 M0 -5 v10 M8 -5 v10 M16 -4 v8" stroke="#9C6234" stroke-width="1.4"/>${o.baby ? `<g transform="translate(6 -2)">${KS.baby()}</g>` : ''}${o.bread ? `<ellipse cx="-6" cy="-7" rx="8" ry="5" fill="#E7B36A"/><ellipse cx="6" cy="-8" rx="7" ry="4.5" fill="#D9A050"/><g transform="translate(2 -12) scale(.5)">${KS.fish({ c: '#7FB8D8' })}</g>` : ''}</g>`;
KS.reeds = () => `<g stroke="#4E9A3A" stroke-width="3" stroke-linecap="round" fill="none"><path d="M-14 0 Q-16 -30 -10 -48"/><path d="M-4 0 Q-6 -36 2 -58"/><path d="M6 0 Q8 -28 14 -42"/><path d="M14 0 Q18 -24 26 -34"/></g><g fill="#8A5A2B"><ellipse cx="-10" cy="-48" rx="2.6" ry="6"/><ellipse cx="2" cy="-58" rx="2.6" ry="6"/></g>`;
KS.wall = (o = {}) => `<g><path d="M-28 0 V-120 ${o.flip ? 'q14 -12 28 0' : 'q14 -12 28 0'} V0Z" fill="#2F8FCB"/><path d="M-20 -110 q8 -6 14 0 M-18 -80 q8 -6 14 0 M-22 -50 q8 -6 14 0" stroke="#BDE6F2" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`;
KS.stone = () => `<circle r="5" fill="#8C8C8C"/>`;
KS.rock = () => `<path d="M-30 0 Q-34 -26 -10 -30 Q10 -40 26 -22 Q36 -6 30 0Z" fill="#9C8E80"/>`;
KS.pit = () => `<g><ellipse cx="0" cy="0" rx="120" ry="30" fill="#4A3B30"/><ellipse cx="0" cy="-4" rx="112" ry="24" fill="#2E241D"/></g>`;
KS.window = () => `<g><rect x="-26" y="-60" width="52" height="60" rx="26" fill="#BFE6FF" stroke="#C49A6C" stroke-width="5"/><path d="M0 -60 V0 M-26 -28 H26" stroke="#C49A6C" stroke-width="3"/></g>`;
KS.city = (o = {}) => `<g fill="${o.c || '#E8C99A'}"><rect x="-70" y="-50" width="36" height="50"/><rect x="-30" y="-74" width="30" height="74"/><rect x="4" y="-42" width="40" height="42"/><rect x="48" y="-60" width="26" height="60"/><circle cx="-15" cy="-74" r="15"/><g fill="#8C6A44"><rect x="-60" y="-38" width="7" height="9" rx="2"/><rect x="-20" y="-56" width="7" height="9" rx="2"/><rect x="18" y="-30" width="7" height="9" rx="2"/><rect x="56" y="-46" width="7" height="9" rx="2"/></g></g>`;
KS.manger = () => `<g><path d="M-30 -24 L30 -24 L22 -6 L-22 -6Z" fill="#B5703A"/><path d="M-26 -6 L-32 4 M26 -6 L32 4 M-20 -6 L-14 4 M20 -6 L14 4" stroke="#8A5A2B" stroke-width="3.4" stroke-linecap="round"/><path d="M-30 -24 q30 -12 60 0" fill="#F2C94C"/><g transform="translate(6 -22)">${KS.baby()}</g></g>`;
KS.stable = () => `<g><path d="M-80 0 V-70 L0 -110 L80 -70 V0" fill="#8C5A32"/><path d="M-92 -66 L0 -118 L92 -66" stroke="#5A3416" stroke-width="10" fill="none" stroke-linecap="round"/><rect x="-60" y="-66" width="120" height="66" fill="#5A3416" opacity=".35"/></g>`;
KS.tomb = (o = {}) => `<g><path d="M-80 0 Q-86 -80 0 -86 Q86 -80 80 0Z" fill="#A89A8C"/><path d="M-80 0 Q-86 -80 0 -86" stroke="#8F8173" stroke-width="4" fill="none"/>
<ellipse cx="0" cy="-26" rx="22" ry="26" fill="#2A221C"/>${o.open ? `<g transform="translate(52 -4)"><circle cx="0" cy="-24" r="26" fill="#C7BBAE" stroke="#8F8173" stroke-width="3"/></g>${o.light ? `<ellipse cx="0" cy="-26" rx="18" ry="22" fill="#FFF3C4" opacity=".6" class="k-glow"/>` : ''}` : `<circle cx="0" cy="-24" r="26" fill="#C7BBAE" stroke="#8F8173" stroke-width="3"/>`}</g>`;
KS.heart = (o = {}) => `<path d="M0 6 C-14 -4 -12 -16 -5 -16 C-2 -16 0 -13 0 -11 C0 -13 2 -16 5 -16 C12 -16 14 -4 0 6Z" fill="${o.c || '#EF3340'}"/>`;
KS.notes = () => `<g fill="#FFFFFF"><path d="M0 0 V-18 L12 -22 V-4" stroke="#fff" stroke-width="2" fill="none"/><circle cx="-2" cy="0" r="3.5"/><circle cx="10" cy="-4" r="3.5"/></g>`;
KS.bubbles = () => `<g fill="none" stroke="#DFF4FF" stroke-width="2"><circle cx="0" cy="0" r="4"/><circle cx="6" cy="-12" r="3"/><circle cx="-2" cy="-22" r="2.4"/></g>`;
KS.rainbow = () => `<g fill="none" stroke-width="9">${['#EF3340', '#FF8A3D', '#FFD54A', '#5BAE5B', '#3FA2D9', '#7E57C2'].map((c, i) => `<path d="M-${140 - i * 9} 0 A${140 - i * 9} ${140 - i * 9} 0 0 1 ${140 - i * 9} 0" stroke="${c}"/>`).join('')}</g>`;
KS.sling = () => `<g><path d="M0 0 Q-8 -20 -2 -34" stroke="#8A5A2B" stroke-width="2" fill="none"/><circle cx="-2" cy="-36" r="4" fill="#8C8C8C"/></g>`;
KS.glow = () => `<defs><radialGradient id="kglowg"><stop offset="0" stop-color="#FFFBE6" stop-opacity=".95"/><stop offset=".45" stop-color="#FFE9A0" stop-opacity=".55"/><stop offset="1" stop-color="#FFE9A0" stop-opacity="0"/></radialGradient></defs><circle r="75" fill="url(#kglowg)" class="k-glow"/>`;
KS.question = () => `<text x="0" y="0" font-size="30" font-weight="800" fill="#FFFFFF" font-family="sans-serif" text-anchor="middle">?</text>`;

// Backgrounds: sky and ground for each kind of scene.
const KBG = {
  day: ['#8FD3FF', '#E8F7FF', '#7CCF6E'], dawn: ['#FFB38A', '#FFE3C2', '#8BCB72'], night: ['#1B2148', '#3E2F6B', '#2E4F3A'],
  dark: ['#0D0E14', '#1C1F2E', '#151820'], sea: ['#8FD3FF', '#E8F7FF', null], storm: ['#4B5563', '#8A94A6', null],
  desert: ['#FFC88A', '#FFF0D6', '#E9C27A'], under: ['#2D8FBF', '#1B5E8A', null], evening: ['#C2557A', '#F2A36B', '#6E9B5A']
};

// One piece placed in a scene: [sprite, x, y, scale, animation, options].
function kPiece(p, i) {
  const [name, x, y, sc = 1, anim = '', opt = {}] = p;
  const make = KS[name];
  if (!make) return '';
  return `<g transform="translate(${x} ${y}) scale(${sc})"><g class="k-in" style="animation-delay:${Math.min(0.1 * i, 0.6)}s"><g class="${anim ? 'k-' + anim : ''}">${make(opt)}</g></g></g>`;
}
function kScene(sc, small) {
  const [top, mid, ground] = KBG[sc.bg] || KBG.day;
  const id = 'kg' + (sc.bg || 'day');
  return `<svg class="kscene${small ? ' small' : ''}" viewBox="0 0 400 260" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
<rect width="400" height="260" fill="url(#${id})"/>
${sc.bg === 'night' || sc.bg === 'dark' ? Array.from({ length: 18 }, (_, i) => `<circle class="k-twinkle" style="animation-delay:${(i % 6) * 0.4}s" cx="${(i * 73) % 400}" cy="${(i * 37) % 130 + 8}" r="${1 + (i % 3) * 0.6}" fill="#fff"/>`).join('') : ''}
${ground ? `<path d="M0 205 Q100 188 200 200 T400 196 V260 H0Z" fill="${ground}"/>` : ''}
${sc.items.map(kPiece).join('')}
</svg>`;
}

// ---------- the stories ----------
// Retold simply for children by this app (draft, to be checked by a Sunday-school teacher).
// Each scene: background, pieces, and the words in Amharic and English. Each quiz: question, three answers, the right one.
const P = (o) => o; // readability: person options
const KIDS = [
  { id: 'creation', c: '#FFB547', n: ['እግዚአብሔር ዓለምን ፈጠረ', 'God makes the world'], ref: [0, 1, 1], from: 'ዘፍጥረት 1–2 · Genesis 1–2',
    scenes: [
      { bg: 'dark', items: [['glow', 200, 120, 1.4, 'pulse'], ['star', 120, 60, 1, 'twinkle'], ['star', 290, 80, 1.2, 'twinkle']],
        t: ['በመጀመሪያ ሁሉም ጨለማ ነበር። እግዚአብሔርም “ብርሃን ይሁን” አለ፤ ብርሃንም ሆነ!', 'In the beginning everything was dark. God said, “Let there be light!” And there was light!'] },
      { bg: 'sea', items: [['cloud', 90, 60, 1, 'drift'], ['cloud', 300, 45, .8, 'drift'], ['waves', 100, 190, 1, '', { c: '#3FA2D9' }], ['hills', 200, 200, 1, 'rise', { c: '#7CCF6E' }]],
        t: ['እግዚአብሔር ሰማይን፣ ባሕርንና የብስን ሠራ።', 'God made the sky, the sea and the dry land.'] },
      { bg: 'day', items: [['sun', 330, 55, 1, 'float'], ['moon', 60, 50, .9, 'float'], ['tree', 110, 205, 1.1, 'sway'], ['tree', 290, 205, .9, 'sway'], ['flower', 190, 210, 1.2, 'sway', { c: '#FF6B8B' }], ['flower', 220, 214, 1, 'sway', { c: '#FFD54A' }], ['flower', 160, 214, 1, 'sway', { c: '#B388FF' }]],
        t: ['ዛፎችን፣ አበቦችን፣ ፀሐይን፣ ጨረቃንና ከዋክብትን ሠራ።', 'He made trees and flowers, the sun, the moon and the stars.'] },
      { bg: 'day', items: [['dove', 90, 60, 1.3, 'fly'], ['dove', 300, 80, 1, 'fly'], ['lion', 110, 210, 1.1, 'bob'], ['sheep', 230, 212, 1.3, 'bob'], ['sheep', 290, 214, 1, 'bob', { flip: true }], ['person', 180, 212, 1.05, 'jump', P({ robe: '#4CAF50', skin: SKIN[1] })], ['person', 345, 212, 1.05, 'jump', P({ robe: '#EF3340', skin: SKIN[0], scarf: '#FFB547' })]],
        t: ['ወፎችን፣ ዓሣዎችንና እንስሳትን ሁሉ፣ በመጨረሻም ሰውን በራሱ መልክ ፈጠረ። ሁሉም እጅግ መልካም ነበር!', 'He made birds, fish and every animal, and last of all people, made like Him. Everything was very good!'] }
    ],
    quiz: [
      [['ሁሉን የፈጠረው ማን ነው?', 'Who made everything?'], [['እግዚአብሔር', 'God'], ['አንድ ንጉሥ', 'A king'], ['እንስሳት', 'The animals']], 0],
      [['እግዚአብሔር መጀመሪያ ምን ፈጠረ?', 'What did God make first?'], [['ዓሣ', 'Fish'], ['ብርሃን', 'Light'], ['ዛፍ', 'Trees']], 1]
    ] },
  { id: 'noah', c: '#3FA2D9', n: ['የኖኅ መርከብ', 'Noah’s big boat'], ref: [0, 9, 13], from: 'ዘፍጥረት 6–9 · Genesis 6–9',
    scenes: [
      { bg: 'day', items: [['sun', 340, 50, .8, 'float'], ['ark', 210, 196, 1, 'rise'], ['person', 80, 212, 1.1, 'bob', P({ robe: '#8D6E63', beard: '#EDEDED', hair: '#EDEDED', staff: true })]],
        t: ['ኖኅ እግዚአብሔርን የሚወድ ሰው ነበር። እግዚአብሔርም “ትልቅ መርከብ ሥራ” አለው።', 'Noah loved God. God told him, “Build a very big boat.”'] },
      { bg: 'day', items: [['ark', 270, 196, .9], ['lion', 80, 212, .8, 'walk'], ['lion', 130, 214, .7, 'walk'], ['sheep', 175, 214, 1, 'walk'], ['sheep', 205, 216, .9, 'walk'], ['dove', 120, 70, 1, 'fly'], ['dove', 160, 90, .8, 'fly']],
        t: ['እንስሳቱ ሁሉ ሁለት ሁለት ሆነው ወደ መርከቡ ገቡ።', 'The animals came two by two into the boat.'] },
      { bg: 'storm', items: [['cloud', 80, 40, 1.2, 'drift', { dark: true }], ['cloud', 300, 50, 1.3, 'drift', { dark: true }], ['rain', 80, 70, 1.2], ['rain', 300, 80, 1.2], ['ark', 200, 175, 1, 'rock', { peek: true }], ['waves', 100, 190, 1, '', { c: '#2B6CB0', big: true }]],
        t: ['ብዙ ቀን ዝናብ ዘነበ፤ ውኃው ምድርን ሸፈነ። መርከቡ ግን በሰላም ተንሳፈፈ።', 'It rained for many days and water covered the earth. But the boat floated safely.'] },
      { bg: 'day', items: [['rainbow', 200, 180, 1, 'rise'], ['sun', 340, 50, .7, 'float'], ['ark', 120, 196, .7], ['dove', 260, 90, 1.3, 'fly', { leaf: true }], ['person', 250, 212, 1.1, 'jump', P({ robe: '#8D6E63', beard: '#EDEDED', hair: '#EDEDED', pose: 'up' })], ['sheep', 310, 214, 1, 'bob']],
        t: ['ርግቧ የወይራ ቅጠል ይዛ መጣች። እግዚአብሔርም ቀስተ ደመናን አሳይቶ የተስፋ ቃል ሰጠ።', 'The dove came back with a leaf. God put a rainbow in the sky as a promise.'] }
    ],
    quiz: [
      [['ኖኅ ምን ሠራ?', 'What did Noah build?'], [['ትልቅ ቤት', 'A big house'], ['ትልቅ መርከብ', 'A big boat'], ['ግንብ', 'A tower']], 1],
      [['እግዚአብሔር ለተስፋ ቃሉ ምልክት በሰማይ ምን አደረገ?', 'What did God put in the sky as a promise?'], [['ቀስተ ደመና', 'A rainbow'], ['ጨረቃ', 'The moon'], ['ወፍ', 'A bird']], 0]
    ] },
  { id: 'moses', c: '#4FC3A1', n: ['ሕፃኑ ሙሴ', 'Baby Moses'], ref: [1, 2, 10], from: 'ዘጸአት 2 · Exodus 2',
    scenes: [
      { bg: 'sea', items: [['sun', 340, 50, .7, 'float'], ['waves', 100, 180, 1, '', { c: '#4FA8C9' }], ['basket', 200, 182, 1.6, 'rock', { baby: true }], ['reeds', 70, 190, 1.4, 'sway'], ['reeds', 330, 190, 1.2, 'sway']],
        t: ['የሙሴ እናት ልጅዋን ለመጠበቅ በቅርጫት አድርጋ በወንዙ ዳር አስቀመጠችው።', 'To keep her baby safe, Moses’ mother put him in a basket by the river.'] },
      { bg: 'sea', items: [['waves', 100, 180, 1, '', { c: '#4FA8C9' }], ['basket', 230, 182, 1.5, 'rock', { baby: true }], ['person', 90, 200, .8, 'peek', P({ robe: '#FF8A65', skin: SKIN[1], scarf: '#7E57C2' })], ['reeds', 110, 196, 1.6, 'sway'], ['reeds', 340, 190, 1.2, 'sway']],
        t: ['እኅቱ ማርያም ተደብቃ ትጠብቀው ነበር።', 'His sister Miriam hid nearby and watched over him.'] },
      { bg: 'sea', items: [['waves', 100, 185, 1, '', { c: '#4FA8C9' }], ['person', 150, 205, 1.15, 'bob', P({ robe: '#F5C04A', skin: SKIN[3], crown: true, pose: 'hold' })], ['basket', 245, 190, 1.4, 'rock', { baby: true }], ['heart', 200, 120, 1.4, 'pulse'], ['palm', 340, 200, 1, 'sway']],
        t: ['የፈርዖን ልጅ ቅርጫቱን አገኘችው፤ ሕፃኑንም ወደደችው።', 'Pharaoh’s daughter found the basket and loved the little baby.'] },
      { bg: 'day', items: [['sun', 330, 55, .9, 'float'], ['person', 170, 212, 1.15, 'bob', P({ robe: '#F5C04A', skin: SKIN[3], crown: true })], ['basket', 230, 206, 1.3, '', { baby: true }], ['heart', 120, 90, 1, 'pulse'], ['heart', 280, 110, .8, 'pulse']],
        t: ['ስሙንም ሙሴ ብላ ጠራችው። እግዚአብሔር ሕፃኑን ጠበቀው።', 'She named him Moses. God kept the baby safe.'] }
    ],
    quiz: [
      [['ሕፃኑ ሙሴ የት ተቀመጠ?', 'Where was baby Moses placed?'], [['በዛፍ ላይ', 'In a tree'], ['በወንዝ ላይ በቅርጫት', 'In a basket on the river'], ['በዋሻ', 'In a cave']], 1],
      [['ሙሴን ተደብቃ የጠበቀችው ማን ናት?', 'Who hid and watched over Moses?'], [['እኅቱ ማርያም', 'His sister Miriam'], ['አንበሳ', 'A lion'], ['ንጉሡ', 'The king']], 0]
    ] },
  { id: 'redsea', c: '#2F8FCB', n: ['ቀይ ባሕር ተከፈለ', 'The sea opens up'], ref: [1, 14, 14], from: 'ዘጸአት 14 · Exodus 14',
    scenes: [
      { bg: 'desert', items: [['waves', 100, 160, 1, '', { c: '#2F8FCB', big: true }], ['person', 90, 225, 1.1, 'bob', P({ robe: '#8D6E63', beard: '#5D4037', staff: true })], ['person', 150, 228, .9, 'bob', P({ robe: '#EF3340', skin: SKIN[1], scarf: '#FFB547', mood: 'scared' })], ['person', 200, 230, .7, 'bob', P({ robe: '#4CAF50', skin: SKIN[2], mood: 'scared' })]],
        t: ['እስራኤላውያን ከግብፅ ወጡ። ከፊታቸው ግን ትልቅ ባሕር ነበረ።', 'God’s people left Egypt, but a big sea was in front of them.'] },
      { bg: 'desert', items: [['wall', 120, 230, 1.1, 'rise'], ['wall', 280, 230, 1.1, 'rise'], ['person', 200, 228, 1.2, 'jump', P({ robe: '#8D6E63', beard: '#5D4037', staff: true, pose: 'up' })]],
        t: ['ሙሴ በትሩን ዘረጋ፤ እግዚአብሔርም ባሕሩን ከፈለው!', 'Moses held up his staff, and God split the sea in two!'] },
      { bg: 'desert', items: [['wall', 90, 230, 1.1], ['wall', 310, 230, 1.1], ['person', 160, 228, .9, 'walk', P({ robe: '#EF3340', skin: SKIN[1], scarf: '#FFB547' })], ['person', 200, 232, .75, 'walk', P({ robe: '#4CAF50', skin: SKIN[2] })], ['person', 240, 228, .9, 'walk', P({ robe: '#7E57C2', skin: SKIN[0] })], ['sheep', 270, 234, .8, 'walk']],
        t: ['ሕዝቡ በደረቅ መሬት በባሕሩ መካከል ተሻገሩ።', 'The people walked through the middle of the sea on dry ground.'] },
      { bg: 'dawn', items: [['sun', 330, 60, .9, 'float'], ['waves', 100, 120, .9, '', { c: '#2F8FCB' }], ['person', 110, 230, 1, 'jump', P({ robe: '#EF3340', skin: SKIN[1], scarf: '#FFB547', pose: 'up' })], ['person', 200, 230, 1, 'jump', P({ robe: '#8D6E63', beard: '#5D4037', pose: 'up' })], ['person', 290, 230, 1, 'jump', P({ robe: '#4CAF50', skin: SKIN[2], pose: 'up' })], ['notes', 150, 120, 1.3, 'float'], ['notes', 260, 110, 1.1, 'float']],
        t: ['ሁሉም በደስታ ዘመሩ፤ እግዚአብሔርን አመሰገኑ።', 'Everyone sang for joy and thanked God.'] }
    ],
    quiz: [
      [['እግዚአብሔር ባሕሩን ምን አደረገው?', 'What did God do to the sea?'], [['ከፈለው', 'He opened a dry path'], ['አቀዘቀዘው', 'He froze it'], ['ምንም', 'Nothing']], 0],
      [['በትሩን የዘረጋው ማን ነው?', 'Who held up his staff?'], [['ኖኅ', 'Noah'], ['ሙሴ', 'Moses'], ['ዳዊት', 'David']], 1]
    ] },
  { id: 'david', c: '#7CB342', n: ['ዳዊትና ጎልያድ', 'David and the giant'], ref: [8, 17, 47], from: '1 ሳሙኤል 17 · 1 Samuel 17',
    scenes: [
      { bg: 'day', items: [['sun', 340, 50, .8, 'float'], ['hills', 200, 200, 1, '', { c: '#8BCB72' }], ['person', 150, 214, .9, 'bob', P({ robe: '#7CB342', skin: SKIN[1], staff: true })], ['sheep', 220, 216, 1, 'bob'], ['sheep', 260, 212, .9, 'bob', { flip: true }], ['sheep', 300, 216, 1.1, 'bob']],
        t: ['ዳዊት በጎችን የሚጠብቅ ትንሽ እረኛ ልጅ ነበር።', 'David was a young shepherd boy who looked after sheep.'] },
      { bg: 'desert', items: [['person', 260, 214, 2.4, 'stomp', P({ robe: '#6D6D6D', skin: SKIN[2], beard: '#2B1B12', sash: '#B0B0B0' })], ['person', 80, 214, .9, 'shake', P({ robe: '#EF3340', skin: SKIN[0], mood: 'scared' })], ['person', 120, 216, .8, 'shake', P({ robe: '#7E57C2', skin: SKIN[3], mood: 'scared' })]],
        t: ['ጎልያድ የሚባል ግዙፍ ሰው ሁሉንም ያስፈራ ነበር።', 'A giant called Goliath made everyone afraid.'] },
      { bg: 'desert', items: [['person', 300, 214, 2.4, '', P({ robe: '#6D6D6D', skin: SKIN[2], beard: '#2B1B12', sash: '#B0B0B0', mood: 'scared' })], ['person', 90, 214, 1, 'bob', P({ robe: '#7CB342', skin: SKIN[1], pose: 'up' })], ['stone', 120, 140, 1.4, 'throw']],
        t: ['ዳዊት “እግዚአብሔር ከእኔ ጋር ነው” ብሎ በወንጭፉ ድንጋይ ወረወረ።', 'David said, “God is with me,” and threw a stone with his sling.'] },
      { bg: 'day', items: [['sun', 330, 55, .9, 'float'], ['person', 180, 214, 1.1, 'jump', P({ robe: '#7CB342', skin: SKIN[1], pose: 'up' })], ['person', 110, 214, 1, 'jump', P({ robe: '#EF3340', skin: SKIN[0], pose: 'up' })], ['person', 260, 214, 1, 'jump', P({ robe: '#7E57C2', skin: SKIN[3], pose: 'up' })], ['star', 140, 80, 1.4, 'twinkle'], ['star', 230, 70, 1.2, 'twinkle']],
        t: ['ጎልያድ ወደቀ! ትንሹ ዳዊት በእግዚአብሔር ታምኖ አሸነፈ።', 'Goliath fell down! Little David trusted God and won.'] }
    ],
    quiz: [
      [['ዳዊት በምን ተጠቀመ?', 'What did David use?'], [['በሰይፍ', 'A sword'], ['በወንጭፍና በድንጋይ', 'A sling and a stone'], ['በቀስት', 'A bow']], 1],
      [['ዳዊትን የረዳው ማን ነው?', 'Who helped David?'], [['በጎቹ', 'The sheep'], ['ጎልያድ', 'Goliath'], ['እግዚአብሔር', 'God']], 2]
    ] },
  { id: 'daniel', c: '#E8A548', n: ['ዳንኤልና አንበሶቹ', 'Daniel and the lions'], ref: [26, 6, 22], from: 'ዳንኤል 6 · Daniel 6',
    scenes: [
      { bg: 'day', items: [['window', 280, 200, 1.6], ['person', 160, 214, 1.2, 'bob', P({ robe: '#3F51B5', skin: SKIN[0], pose: 'pray', eyes: 'closed' })], ['heart', 230, 90, 1, 'pulse']],
        t: ['ዳንኤል በየቀኑ ሦስት ጊዜ ወደ እግዚአብሔር ይጸልይ ነበር።', 'Every day, three times a day, Daniel prayed to God.'] },
      { bg: 'dark', items: [['pit', 200, 220, 1.4], ['lion', 100, 214, 1, 'prowl'], ['lion', 310, 214, 1, 'prowl', { flip: true }], ['person', 200, 214, 1.1, '', P({ robe: '#3F51B5', skin: SKIN[0], mood: 'sad' })]],
        t: ['ክፉ ሰዎች ዳንኤልን ወደ አንበሶች ጉድጓድ አስጣሉት።', 'Some bad men had Daniel thrown into a den of lions.'] },
      { bg: 'dark', items: [['glow', 200, 120, 1.3, 'pulse'], ['person', 200, 150, 1.2, 'float', P({ robe: '#FFFFFF', skin: SKIN[3], wings: true, halo: true, sash: '#F5C04A' })], ['lion', 90, 220, 1, '', { sleepy: true }], ['lion', 320, 220, 1, '', { sleepy: true, flip: true }], ['person', 200, 230, .9, 'bob', P({ robe: '#3F51B5', skin: SKIN[0], pose: 'pray', eyes: 'closed' })]],
        t: ['እግዚአብሔር መልአኩን ልኮ የአንበሶቹን አፍ ዘጋ።', 'God sent His angel to shut the lions’ mouths.'] },
      { bg: 'dawn', items: [['sun', 330, 60, .9, 'float'], ['person', 130, 214, 1.2, 'jump', P({ robe: '#3F51B5', skin: SKIN[0], pose: 'up' })], ['person', 240, 214, 1.2, 'bob', P({ robe: '#7E57C2', skin: SKIN[2], crown: true, beard: '#2B1B12' })], ['lion', 330, 220, .8, '', { sleepy: true, flip: true }]],
        t: ['ጠዋት ንጉሡ መጣ፤ ዳንኤል ምንም አልሆነም! እግዚአብሔር ጠበቀው።', 'In the morning the king came: Daniel was fine! God had kept him safe.'] }
    ],
    quiz: [
      [['ዳንኤል በቀን ስንት ጊዜ ይጸልይ ነበር?', 'How many times a day did Daniel pray?'], [['አንድ ጊዜ', 'Once'], ['ሦስት ጊዜ', 'Three times'], ['ፈጽሞ', 'Never']], 1],
      [['የአንበሶቹን አፍ የዘጋው ማን ነው?', 'Who shut the lions’ mouths?'], [['የእግዚአብሔር መልአክ', 'God’s angel'], ['ንጉሡ', 'The king'], ['ዳንኤል', 'Daniel']], 0]
    ] },
  { id: 'jonah', c: '#26A69A', n: ['ዮናስና ትልቁ ዓሣ', 'Jonah and the big fish'], ref: [31, 2, 9], from: 'ዮናስ 1–3 · Jonah 1–3',
    scenes: [
      { bg: 'sea', items: [['sun', 340, 50, .8, 'float'], ['boat', 200, 172, 1.2, 'rock'], ['person', 180, 160, .7, '', P({ robe: '#26A69A', skin: SKIN[1], mood: 'sad' })], ['waves', 100, 180, 1, '', { c: '#3FA2D9' }]],
        t: ['እግዚአብሔር ዮናስን “ወደ ነነዌ ሂድ” አለው። ዮናስ ግን በመርከብ ወደ ሌላ ቦታ ሸሸ።', 'God told Jonah, “Go to Nineveh.” But Jonah ran away on a boat.'] },
      { bg: 'storm', items: [['cloud', 90, 40, 1.3, 'drift', { dark: true }], ['cloud', 300, 50, 1.2, 'drift', { dark: true }], ['rain', 200, 60, 1.6], ['boat', 200, 168, 1.2, 'rock', { sail: false }], ['waves', 100, 178, 1, '', { c: '#2B6CB0', big: true }]],
        t: ['ታላቅ ማዕበል ተነሣ። ዮናስ ወደ ባሕሩ ተጣለ።', 'A huge storm came. Jonah was thrown into the sea.'] },
      { bg: 'under', items: [['bigfish', 200, 140, 1.4, 'swim'], ['person', 210, 150, .55, '', P({ robe: '#26A69A', skin: SKIN[1], pose: 'pray', eyes: 'closed' })], ['bubbles', 320, 80, 1.4, 'rise'], ['bubbles', 80, 120, 1.1, 'rise'], ['fish', 70, 220, 1, 'swim', { c: '#FFD54A' }]],
        t: ['ትልቅ ዓሣ ዋጠው! ዮናስ በዓሣው ሆድ ውስጥ ሦስት ቀን ወደ እግዚአብሔር ጸለየ።', 'A big fish swallowed him! Inside the fish, Jonah prayed to God for three days.'] },
      { bg: 'day', items: [['sun', 330, 55, .8, 'float'], ['city', 300, 205, 1.1, 'rise'], ['person', 140, 214, 1.15, 'walk', P({ robe: '#26A69A', skin: SKIN[1] })], ['heart', 220, 90, 1.1, 'pulse']],
        t: ['ዓሣው ዮናስን ወደ የብስ ተፋው። ዮናስም ታዘዘ፤ ወደ ነነዌ ሄደ።', 'The fish spat Jonah onto the land. This time Jonah obeyed and went to Nineveh.'] }
    ],
    quiz: [
      [['ዮናስን የዋጠው ምንድን ነው?', 'What swallowed Jonah?'], [['ትልቅ ዓሣ', 'A big fish'], ['አንበሳ', 'A lion'], ['ወፍ', 'A bird']], 0],
      [['እግዚአብሔር ዮናስን ወዴት ላከው?', 'Where did God send Jonah?'], [['ግብፅ', 'Egypt'], ['ነነዌ', 'Nineveh'], ['ቤተ ልሔም', 'Bethlehem']], 1]
    ] },
  { id: 'birth', c: '#7E57C2', n: ['ኢየሱስ ተወለደ', 'Jesus is born'], ref: [41, 2, 11], from: 'ሉቃስ 2 · Luke 2',
    scenes: [
      { bg: 'night', items: [['moon', 340, 50, .9, 'float'], ['city', 290, 205, 1, '', { c: '#C9A97A' }], ['person', 110, 214, 1.1, 'walk', P({ robe: '#8D6E63', skin: SKIN[0], beard: '#2B1B12', staff: true })], ['person', 160, 216, 1, 'walk', P({ robe: '#3F7FD9', skin: SKIN[1], scarf: '#E3F2FD' })]],
        t: ['ማርያምና ዮሴፍ ወደ ቤተ ልሔም ሄዱ። የሚያርፉበት ቦታ አልነበረም።', 'Mary and Joseph went to Bethlehem. There was no room for them to stay.'] },
      { bg: 'night', items: [['star', 200, 40, 2.4, 'twinkle', { c: '#FFE27A' }], ['stable', 200, 214, 1.1], ['manger', 200, 208, 1.3, 'pulse'], ['person', 130, 214, 1, '', P({ robe: '#3F7FD9', skin: SKIN[1], scarf: '#E3F2FD', pose: 'pray' })], ['person', 270, 214, 1, '', P({ robe: '#8D6E63', skin: SKIN[0], beard: '#2B1B12' })], ['sheep', 330, 216, .9, 'bob', { flip: true }]],
        t: ['ኢየሱስ ተወለደ፤ በግርግም ውስጥ ተኛ።', 'Jesus was born, and was laid in a manger.'] },
      { bg: 'night', items: [['glow', 200, 80, 1.3, 'pulse'], ['person', 200, 120, 1.2, 'float', P({ robe: '#FFFFFF', skin: SKIN[3], wings: true, halo: true, sash: '#F5C04A', pose: 'up' })], ['person', 90, 214, 1, 'shake', P({ robe: '#8D6E63', skin: SKIN[2], staff: true, mood: 'scared' })], ['person', 300, 214, 1, 'shake', P({ robe: '#A1887F', skin: SKIN[0], beard: '#2B1B12', mood: 'scared' })], ['sheep', 150, 216, .9, 'bob'], ['sheep', 250, 218, .8, 'bob', { flip: true }]],
        t: ['መልአክ ለእረኞቹ ታየ፦ “ታላቅ ደስታ የምሥራች እነግራችኋለሁ፤ አዳኝ ተወልዶላችኋል!”', 'An angel told the shepherds, “Good news of great joy: a Saviour is born for you!”'] },
      { bg: 'night', items: [['star', 200, 40, 2.4, 'twinkle', { c: '#FFE27A' }], ['stable', 200, 214, 1.1], ['manger', 200, 208, 1.3], ['person', 110, 214, 1, 'jump', P({ robe: '#8D6E63', skin: SKIN[2], staff: true, pose: 'up' })], ['person', 290, 214, 1, 'jump', P({ robe: '#A1887F', skin: SKIN[0], beard: '#2B1B12', pose: 'up' })], ['heart', 200, 110, 1, 'pulse']],
        t: ['እረኞቹ ሕፃኑን ለማየት ሮጡ፤ እግዚአብሔርንም አመሰገኑ።', 'The shepherds ran to see the baby, and praised God.'] }
    ],
    quiz: [
      [['ኢየሱስ የተወለደው የት ነው?', 'Where was Jesus born?'], [['በቤተ ልሔም', 'In Bethlehem'], ['በሮም', 'In Rome'], ['በነነዌ', 'In Nineveh']], 0],
      [['ለእረኞቹ የምሥራቹን የነገራቸው ማን ነው?', 'Who told the shepherds the good news?'], [['ንጉሡ', 'The king'], ['መልአክ', 'An angel'], ['ዓሣ', 'A fish']], 1]
    ] },
  { id: 'storm', c: '#5C6BC0', n: ['ኢየሱስ ማዕበሉን አረጋጋ', 'Jesus calms the storm'], ref: [40, 4, 39], from: 'ማርቆስ 4 · Mark 4',
    scenes: [
      { bg: 'evening', items: [['boat', 200, 170, 1.4, 'rock'], ['person', 175, 158, .7, '', P({ robe: '#FFFFFF', skin: SKIN[0], beard: '#2B1B12', eyes: 'closed', sash: '#EF3340' })], ['person', 225, 158, .7, '', P({ robe: '#5C6BC0', skin: SKIN[1] })], ['waves', 100, 178, 1, '', { c: '#3F7FB0' }]],
        t: ['ኢየሱስና ደቀ መዛሙርቱ በጀልባ ባሕሩን ተሻገሩ። ኢየሱስ ተኝቶ ነበር።', 'Jesus and His friends crossed the lake in a boat. Jesus fell asleep.'] },
      { bg: 'storm', items: [['cloud', 90, 40, 1.3, 'drift', { dark: true }], ['cloud', 310, 46, 1.2, 'drift', { dark: true }], ['rain', 200, 60, 1.6], ['boat', 200, 166, 1.4, 'rock', { sail: false }], ['person', 225, 154, .7, 'shake', P({ robe: '#5C6BC0', skin: SKIN[1], mood: 'scared', pose: 'up' })], ['person', 180, 154, .7, 'shake', P({ robe: '#7CB342', skin: SKIN[2], mood: 'scared' })], ['waves', 100, 176, 1, '', { c: '#2B6CB0', big: true }]],
        t: ['ኃይለኛ ማዕበል ተነሣ! ደቀ መዛሙርቱ በጣም ፈሩ።', 'A wild storm came! His friends were very scared.'] },
      { bg: 'storm', items: [['glow', 200, 110, 1, 'pulse'], ['boat', 200, 170, 1.4], ['person', 200, 158, .9, 'bob', P({ robe: '#FFFFFF', skin: SKIN[0], beard: '#2B1B12', sash: '#EF3340', pose: 'up' })], ['waves', 100, 182, 1, '', { c: '#3F7FB0' }]],
        t: ['ኢየሱስ ተነሥቶ ነፋሱንና ባሕሩን “ጸጥ በል” አለ።', 'Jesus stood up and said to the wind and the waves, “Be still!”'] },
      { bg: 'day', items: [['sun', 330, 55, .9, 'float'], ['boat', 200, 172, 1.4], ['person', 180, 160, .7, 'jump', P({ robe: '#5C6BC0', skin: SKIN[1], pose: 'up' })], ['person', 222, 160, .7, '', P({ robe: '#FFFFFF', skin: SKIN[0], beard: '#2B1B12', sash: '#EF3340' })], ['waves', 100, 184, 1, '', { c: '#4FA8C9' }], ['fish', 90, 230, 1, 'swim', { c: '#FFD54A' }]],
        t: ['ማዕበሉ ቆመ፤ ሁሉም ተደነቁ፦ “ነፋስና ባሕር እንኳ ይታዘዙለታል!”', 'All was calm. They were amazed: “Even the wind and the waves obey Him!”'] }
    ],
    quiz: [
      [['ማዕበሉ ሲነሣ ኢየሱስ ምን እያደረገ ነበር?', 'What was Jesus doing when the storm began?'], [['ተኝቶ', 'Sleeping'], ['ዓሣ እያጠመደ', 'Fishing'], ['እየበላ', 'Eating']], 0],
      [['ኢየሱስ “ጸጥ በል” ሲል ምን ሆነ?', 'What happened when Jesus said “Be still”?'], [['ዝናቡ በዛ', 'It rained more'], ['ማዕበሉ ቆመ', 'The storm stopped'], ['ጀልባዋ ሰጠመች', 'The boat sank']], 1]
    ] },
  { id: 'loaves', c: '#F2994A', n: ['አምስት እንጀራና ሁለት ዓሣ', 'Five loaves and two fish'], ref: [42, 6, 35], from: 'ዮሐንስ 6 · John 6',
    scenes: [
      { bg: 'day', items: [['hills', 200, 200, 1, '', { c: '#8BCB72' }], ['person', 70, 210, .9, 'bob', P({ robe: '#EF3340', skin: SKIN[0] })], ['person', 120, 214, .8, 'bob', P({ robe: '#4CAF50', skin: SKIN[2], scarf: '#FFB547' })], ['person', 170, 210, .9, 'bob', P({ robe: '#7E57C2', skin: SKIN[1] })], ['person', 230, 214, .85, 'bob', P({ robe: '#3F7FD9', skin: SKIN[3] })], ['person', 290, 210, .9, 'bob', P({ robe: '#F5C04A', skin: SKIN[0], scarf: '#EF3340' })], ['person', 340, 214, .8, 'bob', P({ robe: '#26A69A', skin: SKIN[1] })]],
        t: ['ብዙ ሕዝብ ኢየሱስን ለመስማት መጣ። ቀኑ መሸ፤ ሁሉም ተራቡ።', 'A huge crowd came to hear Jesus. It got late and everyone was hungry.'] },
      { bg: 'day', items: [['person', 160, 214, .85, 'bob', P({ robe: '#F2994A', skin: SKIN[1], pose: 'hold' })], ['basket', 195, 176, 1.1, 'pulse', { bread: true }], ['person', 270, 214, 1.1, '', P({ robe: '#FFFFFF', skin: SKIN[0], beard: '#2B1B12', sash: '#EF3340' })]],
        t: ['አንድ ትንሽ ልጅ ያለውን አምስት እንጀራና ሁለት ዓሣ ሰጠ።', 'A little boy gave what he had: five loaves and two fish.'] },
      { bg: 'day', items: [['person', 200, 214, 1.2, 'bob', P({ robe: '#FFFFFF', skin: SKIN[0], beard: '#2B1B12', sash: '#EF3340', pose: 'up' })], ['basket', 110, 206, 1.2, 'jump', { bread: true }], ['basket', 290, 206, 1.2, 'jump', { bread: true }], ['basket', 60, 214, 1, 'jump', { bread: true }], ['basket', 340, 214, 1, 'jump', { bread: true }], ['heart', 200, 70, 1.2, 'pulse']],
        t: ['ኢየሱስ አመስግኖ አካፈለ፤ ከአምስት ሺህ በላይ ሰዎች በልተው ጠገቡ!', 'Jesus gave thanks and shared it out. More than five thousand people ate until they were full!'] },
      { bg: 'day', items: Array.from({ length: 12 }, (_, i) => ['basket', 50 + (i % 6) * 60, 160 + Math.floor(i / 6) * 50, 1, 'pop', { bread: true }]),
        t: ['የተረፈውም አሥራ ሁለት ቅርጫት ሞላ!', 'And there were twelve baskets of leftovers!'] }
    ],
    quiz: [
      [['ልጁ ምን ሰጠ?', 'What did the boy share?'], [['ፍራፍሬ', 'Fruit'], ['አምስት እንጀራና ሁለት ዓሣ', 'Five loaves and two fish'], ['ማር', 'Honey']], 1],
      [['ስንት ቅርጫት ተረፈ?', 'How many baskets were left over?'], [['12', '12'], ['2', '2'], ['100', '100']], 0]
    ] },
  { id: 'sheep', c: '#66BB6A', n: ['የጠፋው በግ', 'The lost sheep'], ref: [41, 15, 6], from: 'ሉቃስ 15 · Luke 15',
    scenes: [
      { bg: 'day', items: [['sun', 340, 50, .8, 'float'], ['person', 70, 214, 1.1, 'bob', P({ robe: '#8D6E63', skin: SKIN[1], staff: true })], ...Array.from({ length: 8 }, (_, i) => ['sheep', 130 + (i % 4) * 60, 195 + Math.floor(i / 4) * 20, .9, 'bob', { flip: i % 2 === 1 }])],
        t: ['አንድ ደግ እረኛ መቶ በጎች ነበሩት።', 'A kind shepherd had a hundred sheep.'] },
      { bg: 'evening', items: [['rock', 290, 210, 1.6], ['sheep', 300, 212, 1, 'shake', { flip: true }], ['question', 300, 150, 1.2, 'float'], ['tree', 90, 205, 1, 'sway']],
        t: ['አንድ ቀን አንዱ በግ ጠፋ!', 'One day, one little sheep got lost!'] },
      { bg: 'evening', items: [['hills', 200, 200, 1, '', { c: '#6E9B5A' }], ['person', 160, 214, 1.1, 'walk', P({ robe: '#8D6E63', skin: SKIN[1], staff: true })], ['rock', 320, 214, 1.3], ['sheep', 330, 216, .9, 'shake', { flip: true }]],
        t: ['እረኛው ዘጠና ዘጠኙን ትቶ እስኪያገኘው ድረስ ፈለገው።', 'The shepherd left the ninety-nine and searched until he found it.'] },
      { bg: 'dawn', items: [['sun', 330, 60, .9, 'float'], ['sheep', 194, 178, 1.7, 'bob'], ['person', 200, 214, 1.3, 'jump', P({ robe: '#8D6E63', skin: SKIN[1] })], ['heart', 130, 100, 1.2, 'pulse'], ['heart', 270, 90, 1, 'pulse']],
        t: ['በትከሻው ተሸክሞ በደስታ ወደ ቤት መለሰው። እግዚአብሔርም እያንዳንዳችንን እንዲሁ ይወድደናል።', 'He carried it home on his shoulders with joy. God loves each one of us just like that.'] }
    ],
    quiz: [
      [['እረኛው ስንት በጎች ነበሩት?', 'How many sheep did the shepherd have?'], [['10', '10'], ['100', '100'], ['1', '1']], 1],
      [['በጉን ሲያገኘው ምን አደረገ?', 'What did he do when he found it?'], [['ተቆጣ', 'He was angry'], ['ሸጠው', 'He sold it'], ['በደስታ ተሸክሞ መለሰው', 'He carried it home with joy']], 2]
    ] },
  { id: 'easter', c: '#EF3340', n: ['ኢየሱስ ተነሣ!', 'Jesus is alive!'], ref: [39, 28, 6], from: 'ማቴዎስ 28 · Matthew 28',
    scenes: [
      { bg: 'evening', items: [['tomb', 220, 205, 1.3], ['person', 90, 214, 1, '', P({ robe: '#3F7FD9', skin: SKIN[1], scarf: '#E3F2FD', mood: 'sad' })], ['person', 340, 214, .95, '', P({ robe: '#8D6E63', skin: SKIN[0], mood: 'sad' })]],
        t: ['ኢየሱስ ስለ እኛ ሞተ፤ በመቃብርም ተቀበረ። ወዳጆቹ በጣም አዘኑ።', 'Jesus died for us and was laid in a tomb. His friends were very sad.'] },
      { bg: 'dawn', items: [['sun', 60, 200, 1, 'rise'], ['tomb', 250, 205, 1.3], ['person', 110, 214, 1, 'walk', P({ robe: '#7E57C2', skin: SKIN[2], scarf: '#FFB547' })], ['person', 150, 216, .95, 'walk', P({ robe: '#3F7FD9', skin: SKIN[1], scarf: '#E3F2FD' })]],
        t: ['በሦስተኛው ቀን ጠዋት ሴቶች ወደ መቃብሩ መጡ።', 'Early on the third day, some women came to the tomb.'] },
      { bg: 'dawn', items: [['tomb', 220, 205, 1.3, '', { open: true, light: true }], ['person', 220, 140, 1.1, 'float', P({ robe: '#FFFFFF', skin: SKIN[3], wings: true, halo: true, sash: '#F5C04A', pose: 'up' })], ['person', 80, 214, 1, 'shake', P({ robe: '#7E57C2', skin: SKIN[2], scarf: '#FFB547', mood: 'scared' })]],
        t: ['ድንጋዩ ተንከባሎ ነበር! መልአኩ “እዚህ የለም፤ ተነሥቷል!” አላቸው።', 'The stone was rolled away! An angel said, “He is not here. He is risen!”'] },
      { bg: 'day', items: [['sun', 330, 55, 1, 'float'], ['glow', 200, 150, 1.1, 'pulse'], ['person', 200, 214, 1.3, 'bob', P({ robe: '#FFFFFF', skin: SKIN[0], beard: '#2B1B12', sash: '#EF3340', pose: 'up' })], ['person', 100, 214, 1, 'jump', P({ robe: '#7E57C2', skin: SKIN[2], scarf: '#FFB547', pose: 'up' })], ['person', 300, 214, 1, 'jump', P({ robe: '#3F7FD9', skin: SKIN[1], scarf: '#E3F2FD', pose: 'up' })], ['flower', 50, 220, 1.2, 'sway'], ['flower', 360, 220, 1.2, 'sway', { c: '#FFD54A' }]],
        t: ['ኢየሱስ ሕያው ነው! ሁሉም በታላቅ ደስታ ተሞሉ።', 'Jesus is alive! Everyone was filled with great joy.'] }
    ],
    quiz: [
      [['በሦስተኛው ቀን ምን ሆነ?', 'What happened on the third day?'], [['ኢየሱስ ከሞት ተነሣ', 'Jesus rose from the dead'], ['በረዶ ዘነበ', 'It snowed'], ['ምንም', 'Nothing']], 0],
      [['ለሴቶቹ “ተነሥቷል” ያላቸው ማን ነው?', 'Who told the women “He is risen”?'], [['ወታደር', 'A soldier'], ['መልአክ', 'An angel'], ['ዓሣ', 'A fish']], 1]
    ] }
];

// ---------- the Kids screen ----------
const kStars = (n, of = 3) => `<span class="kstars" aria-label="${n} / ${of}">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('')}</span>`;
const kQali = (o = {}) => `<svg class="kqali${o.cls ? ' ' + o.cls : ''}" viewBox="-30 -62 70 70" aria-hidden="true"><g class="${o.anim ? 'k-' + o.anim : ''}">${KS.qali(o)}</g></svg>`;

function kVoice() {
  if (!('speechSynthesis' in window)) return null;
  const want = S.en ? 'en' : 'am';
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(want)) || null;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { if (S.screen === 'kids' && S.kid) render(); };
function kSay(text) {
  const v = kVoice();
  if (!v) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v; u.lang = v.lang; u.rate = 0.9; u.pitch = 1.1;
  speechSynthesis.speak(u);
}

function kidsHome() {
  const done = (S.kids && S.kids.done) || {};
  const total = KIDS.reduce((n, k) => n + (done[k.id] || 0), 0);
  return `<div class="kids-hero"><div class="kbubble">${t('ሰላም! እኔ ቃሊ ነኝ። ከመጽሐፍ ቅዱስ ታሪክ አብረን እንማር!', 'Hi! I’m Qali. Let’s learn a Bible story together!')}</div>${kQali({ anim: 'jump', cls: 'big' })}</div>
<div class="row between"><h1 class="ktitle">${t('የልጆች ታሪኮች', 'Stories for kids')}</h1><span class="kpill">${kStars(1, 1)} ${total} / ${KIDS.length * 3}</span></div>
<div class="kgrid">${KIDS.map((k, i) => `<button class="kcard" style="--kc:${k.c}" data-a="kidOpen" data-v="${i}" data-k="kid-${k.id}">
<span class="kthumb">${kScene(k.scenes[0], true)}</span><b>${esc(tp(k.n))}</b><span class="row between" style="width:100%"><span class="ksmall">${esc(k.from.split(' · ')[S.en ? 1 : 0])}</span>${kStars(done[k.id] || 0)}</span></button>`).join('')}</div>
<p class="muted small" style="margin-top:12px">${t('ታሪኮቹ ለልጆች በቀላል ቋንቋ እንደገና የተጻፉ ናቸው፤ ሙሉውን ታሪክ ከወላጆችዎ ጋር በመጽሐፍ ቅዱስ ያንብቡ።', 'The stories are retold simply for children; read the full story in the Bible together with a grown-up.')}</p>`;
}

function kidsPlayer() {
  const st = S.kid, k = KIDS[st.i];
  const head = (label) => `<div class="kbar"><button class="kround" data-a="kidClose" data-k="kid-close" aria-label="${t('ዝጋ', 'Close')}">${icon('close')}</button>
<div class="kdots">${k.scenes.map((_, j) => `<i class="${typeof st.step === 'number' && j <= st.step || typeof st.step !== 'number' ? 'on' : ''}"></i>`).join('')}<i class="${st.step === 'quiz' || st.step === 'done' ? 'on' : ''}">?</i></div>
${label}</div>`;
  if (typeof st.step === 'number') {
    const sc = k.scenes[st.step], text = tp(sc.t), last = st.step === k.scenes.length - 1;
    return `<div class="kplayer" style="--kc:${k.c}">${head(kVoice() ? `<button class="kround" data-a="kidSay" data-k="kid-say" aria-label="${t('አንብብልኝ', 'Read it to me')}" title="${t('አንብብልኝ', 'Read it to me')}">${icon('speaker')}</button>` : '<span style="width:48px"></span>')}
<div class="kstage" data-scene="${st.i}-${st.step}">${kScene(sc)}</div>
<div class="ktext">${kQali({ anim: 'nod', nod: true })}<p>${esc(text)}</p></div>
<div class="knav"><button class="kbtn ghost" data-a="kidStep" data-v="-1" data-k="kid-prev" ${st.step === 0 ? 'disabled' : ''} aria-label="${t('ያለፈው', 'Back')}">${icon('left', 28)}</button>
<button class="kbtn" data-a="kidStep" data-v="1" data-k="kid-next">${last ? t('ጥያቄዎች!', 'Quiz time!') : t('ቀጥል', 'Next')}${icon('right', 26)}</button></div></div>`;
  }
  if (st.step === 'quiz') {
    const [q, opts, right] = k.quiz[st.q], picked = st.picked;
    const answered = picked != null;
    return `<div class="kplayer" style="--kc:${k.c}">${head(`<span class="kpill">${st.q + 1} / ${k.quiz.length}</span>`)}
<div class="kquiz"><div class="ktext q">${kQali({ anim: answered ? (picked === right ? 'jump' : 'shake') : 'nod', happy: answered && picked === right })}<p>${esc(tp(q))}</p></div>
<div class="kopts">${opts.map((o, j) => `<button class="kopt${answered ? (j === right ? ' right' : j === picked ? ' wrong' : ' dim') : ''}" data-a="kidPick" data-v="${j}" data-k="kq-${j}" ${answered ? 'disabled' : ''}><span class="kletter">${'ሀለሐ'[j]}</span>${esc(tp(o))}</button>`).join('')}</div>
${answered ? `<p class="kfeedback ${picked === right ? 'good' : 'bad'}" role="status">${picked === right ? t('ጎበዝ! ትክክል ነው! 🎉', 'Well done! That’s right! 🎉') : t('ምንም አይደለም፤ ትክክለኛው መልስ አረንጓዴው ነው።', 'That’s okay! The right answer is the green one.')}</p>
<div class="knav"><button class="kbtn" data-a="kidNextQ" data-k="kid-nextq">${st.q === k.quiz.length - 1 ? t('ጨርስ', 'Finish') : t('ቀጣይ ጥያቄ', 'Next question')}${icon('right', 26)}</button></div>` : ''}</div></div>`;
  }
  // Done: stars, confetti and the memory verse.
  const stars = 1 + st.right;
  const [b, c, v] = k.ref, verse = verseText(S.primary, b, c, v);
  return `<div class="kplayer" style="--kc:${k.c}">${head('<span style="width:48px"></span>')}
<div class="kdone"><div class="kconfetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.18}s;--c:${['#EF3340', '#FFD54A', '#3FA2D9', '#66BB6A', '#B388FF', '#FF8A3D'][i % 6]}"></i>`).join('')}</div>
${kQali({ anim: 'jump', happy: true, cls: 'big' })}
<h2 class="ktitle">${t('ጎበዝ!', 'Well done!')}</h2><div class="kbigstars">${kStars(stars)}</div>
<p class="ksmall">${t(st.right + ' ከ' + k.quiz.length + ' ጥያቄዎች በትክክል መለሱ።', 'You got ' + st.right + ' of ' + k.quiz.length + ' questions right.')}</p>
<div class="kverse"><span class="ksmall"><b>${t('የሚታወስ ጥቅስ', 'Memory verse')}</b></span><p ${langOf(S.primary, b)}>${verse === null ? '…' : esc(verse || '')}</p><b>${esc(verseRef(b, c, v))}</b></div>
<div class="knav wrap"><button class="kbtn ghost" data-a="kidAgain" data-k="kid-again">${t('እንደገና', 'Play again')}</button><button class="kbtn" data-a="kidClose" data-k="kid-more">${t('ሌሎች ታሪኮች', 'More stories')}</button></div>
<button class="linkbtn" data-a="kidRead" data-k="kid-read">${t('ሙሉውን ታሪክ በመጽሐፍ ቅዱስ አንብብ', 'Read the whole story in the Bible')}</button></div></div>`;
}
function kidsView() {
  return `<div class="wrap kids">${S.kid ? kidsPlayer() : kidsHome()}</div>`;
}

const kidActions = {
  kidOpen(v) { S.kid = { i: +v, step: 0, q: 0, picked: null, right: 0 }; window.scrollTo(0, 0); },
  kidClose() { S.kid = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); },
  kidStep(v) {
    const k = KIDS[S.kid.i], n = S.kid.step + +v;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (n >= k.scenes.length) { S.kid.step = 'quiz'; S.kid.q = 0; S.kid.picked = null; return; }
    S.kid.step = Math.max(0, n);
  },
  kidSay() { const k = KIDS[S.kid.i]; kSay(tp(k.scenes[S.kid.step].t)); return false; },
  kidPick(v) {
    const k = KIDS[S.kid.i];
    S.kid.picked = +v;
    if (+v === k.quiz[S.kid.q][2]) S.kid.right++;
  },
  kidNextQ() {
    const k = KIDS[S.kid.i];
    if (S.kid.q < k.quiz.length - 1) { S.kid.q++; S.kid.picked = null; return; }
    S.kid.step = 'done';
    S.kids = S.kids || { done: {} };
    S.kids.done[k.id] = Math.max(S.kids.done[k.id] || 0, 1 + S.kid.right);
    save('kids');
  },
  kidAgain() { S.kid = { i: S.kid.i, step: 0, q: 0, picked: null, right: 0 }; },
  kidRead() {
    const k = KIDS[S.kid.i], [b, c, v] = k.ref;
    S.kid = null; setPass({ b, c, f: 1, to: 0 }); S.sel = v; S.goVerse = v; S.screen = 'study'; save('screen', 'sel'); window.scrollTo(0, 0);
  }
};
