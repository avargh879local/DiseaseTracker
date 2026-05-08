import Parser from 'rss-parser';
import { Signal, Source, Severity, SignalsResponse } from '@/app/types';

type FeedResult = { signals: Signal[]; ok: boolean; error?: string };
type Coordinates = Signal['coordinates'];
type SignalBase = Omit<Signal, 'disease' | 'location' | 'coordinates' | 'caseCount' | 'deathCount'>;

const REQUEST_HEADERS = {
  Accept: 'application/rss+xml, application/xml, application/json, text/html;q=0.9, */*;q=0.8',
  'User-Agent': 'SENTINEL-Dashboard/1.0 (community disease intelligence)',
};

const parser = new Parser({
  timeout: 10000,
  headers: REQUEST_HEADERS,
  customFields: {
    item: [['content:encoded', 'contentEncoded'], ['dc:date', 'dcDate']],
  },
});

const HIGH_KEYWORDS = [
  'pandemic', 'epidemic', 'public health emergency', 'pheic',
  'international concern', 'ebola', 'marburg', 'lassa', 'plague',
  'cholera', 'sars', 'mers', 'death toll', 'fatalities', 'fatal',
  'killed', 'hemorrhagic', 'bioterrorism', 'anthrax', 'smallpox',
  'h5n1', 'avian influenza', 'mass casualty', 'uncontrolled outbreak',
  'crisis declared', 'severe acute respiratory', 'death',
];

const MEDIUM_KEYWORDS = [
  'outbreak', 'spreading', 'confirmed cases', 'new cases', 'alert',
  'health alert', 'warning', 'detected', 'transmission', 'infection',
  'dengue', 'malaria', 'typhoid', 'hepatitis', 'meningitis', 'mpox',
  'monkeypox', 'influenza', 'respiratory illness', 'zika', 'yellow fever',
  'rabies', 'measles', 'polio', 'tuberculosis', 'fever outbreak',
  'disease spread', 'cases reported', 'under investigation', 'salmonella',
  'e. coli', 'pertussis', 'hantavirus',
];

const REGION_MAP: [string, string[]][] = [
  ['Africa', [
    'africa', 'nigeria', 'congo', 'drc', 'democratic republic', 'kenya',
    'ethiopia', 'ghana', 'senegal', 'cameroon', 'zambia', 'zimbabwe',
    'mozambique', 'south africa', 'west africa', 'east africa', 'sub-saharan',
    'tanzania', 'uganda', 'rwanda', 'sudan', 'somalia', 'madagascar',
    'malawi', 'sierra leone', 'liberia', 'guinea', 'mali', 'niger',
    'chad', 'angola', 'botswana', 'ivory coast', 'burkina faso',
    'cabo verde', 'cape verde',
  ]],
  ['Asia', [
    'asia', 'china', 'india', 'indonesia', 'pakistan', 'bangladesh',
    'vietnam', 'thailand', 'cambodia', 'philippines', 'japan', 'korea',
    'myanmar', 'southeast asia', 'south asia', 'east asia', 'hong kong',
    'taiwan', 'malaysia', 'singapore', 'laos', 'nepal', 'sri lanka',
    'afghanistan', 'kazakhstan', 'uzbekistan', 'mongolia', 'timor',
    'timor-leste',
  ]],
  ['Middle East', [
    'middle east', 'saudi arabia', 'iran', 'iraq', 'jordan', 'yemen',
    'syria', 'lebanon', 'turkey', 'gulf', 'oman', 'kuwait', 'uae',
    'qatar', 'bahrain', 'israel', 'palestine', 'egypt',
  ]],
  ['Europe', [
    'europe', 'france', 'germany', 'italy', 'spain', 'uk', 'united kingdom',
    'poland', 'ukraine', 'russia', 'eastern europe', 'netherlands', 'belgium',
    'sweden', 'norway', 'denmark', 'finland', 'austria', 'switzerland',
    'czech', 'hungary', 'romania', 'bulgaria', 'greece', 'portugal',
  ]],
  ['Americas', [
    'americas', 'united states', 'usa', 'u.s.', 'canada', 'mexico', 'brazil',
    'colombia', 'peru', 'venezuela', 'haiti', 'caribbean', 'latin america',
    'argentina', 'chile', 'ecuador', 'bolivia', 'paraguay', 'uruguay',
    'trinidad', 'jamaica', 'cuba', 'central america', 'guatemala', 'honduras',
    'vermont', 'california', 'colorado', 'michigan', 'connecticut',
  ]],
  ['Pacific', [
    'pacific', 'australia', 'new zealand', 'papua new guinea', 'fiji',
    'solomon islands', 'vanuatu', 'samoa', 'tonga', 'kiribati', 'micronesia',
    'french polynesia',
  ]],
];

const REGION_POINTS: Record<string, { lat: number; lon: number }> = {
  Africa: { lat: 3, lon: 20 },
  Asia: { lat: 30, lon: 96 },
  'Middle East': { lat: 29, lon: 44 },
  Europe: { lat: 51, lon: 14 },
  Americas: { lat: 12, lon: -78 },
  Pacific: { lat: -18, lon: 158 },
  Global: { lat: 14, lon: 12 },
};

const LOCATION_POINTS: {
  name: string;
  region: string;
  lat: number;
  lon: number;
  aliases: string[];
}[] = [
  { name: 'United States', region: 'Americas', lat: 39.8, lon: -98.6, aliases: ['united states', 'usa', 'u.s.', 'california', 'vermont', 'michigan', 'texas', 'colorado', 'connecticut'] },
  { name: 'Canada', region: 'Americas', lat: 56.1, lon: -106.3, aliases: ['canada', 'alberta', 'manitoba'] },
  { name: 'Mexico', region: 'Americas', lat: 23.6, lon: -102.5, aliases: ['mexico'] },
  { name: 'Brazil', region: 'Americas', lat: -14.2, lon: -51.9, aliases: ['brazil', 'mato grosso'] },
  { name: 'Argentina', region: 'Americas', lat: -38.4, lon: -63.6, aliases: ['argentina'] },
  { name: 'Colombia', region: 'Americas', lat: 4.6, lon: -74.3, aliases: ['colombia'] },
  { name: 'Venezuela', region: 'Americas', lat: 6.4, lon: -66.6, aliases: ['venezuela'] },
  { name: 'Bolivia', region: 'Americas', lat: -16.3, lon: -63.6, aliases: ['bolivia'] },
  { name: 'Suriname', region: 'Americas', lat: 4.1, lon: -56, aliases: ['suriname'] },
  { name: 'Cuba', region: 'Americas', lat: 21.5, lon: -79.4, aliases: ['cuba'] },
  { name: 'Haiti', region: 'Americas', lat: 19, lon: -72.3, aliases: ['haiti'] },
  { name: 'Guatemala', region: 'Americas', lat: 15.8, lon: -90.2, aliases: ['guatemala'] },
  { name: 'Honduras', region: 'Americas', lat: 15.2, lon: -86.2, aliases: ['honduras'] },
  { name: 'Vietnam', region: 'Asia', lat: 14.1, lon: 108.3, aliases: ['vietnam', 'viet nam'] },
  { name: 'Thailand', region: 'Asia', lat: 15.9, lon: 101, aliases: ['thailand', 'ubon ratchathani'] },
  { name: 'Taiwan', region: 'Asia', lat: 23.7, lon: 121, aliases: ['taiwan'] },
  { name: 'China', region: 'Asia', lat: 35.9, lon: 104.2, aliases: ['china'] },
  { name: 'India', region: 'Asia', lat: 20.6, lon: 78.9, aliases: ['india', 'uttar pradesh', 'jammu and kashmir'] },
  { name: 'Bangladesh', region: 'Asia', lat: 23.7, lon: 90.4, aliases: ['bangladesh', 'dhaka'] },
  { name: 'Pakistan', region: 'Asia', lat: 30.4, lon: 69.3, aliases: ['pakistan', 'khyber pakhtunkhwa'] },
  { name: 'Indonesia', region: 'Asia', lat: -2.5, lon: 118, aliases: ['indonesia'] },
  { name: 'Philippines', region: 'Asia', lat: 12.9, lon: 121.8, aliases: ['philippines'] },
  { name: 'Japan', region: 'Asia', lat: 36.2, lon: 138.2, aliases: ['japan'] },
  { name: 'South Korea', region: 'Asia', lat: 36.4, lon: 127.8, aliases: ['south korea', 'korea'] },
  { name: 'Timor-Leste', region: 'Asia', lat: -8.8, lon: 125.7, aliases: ['timor-leste', 'timor'] },
  { name: 'Saudi Arabia', region: 'Middle East', lat: 24.1, lon: 44.5, aliases: ['saudi arabia'] },
  { name: 'Iraq', region: 'Middle East', lat: 33.2, lon: 43.7, aliases: ['iraq'] },
  { name: 'Yemen', region: 'Middle East', lat: 15.6, lon: 48, aliases: ['yemen'] },
  { name: 'Iran', region: 'Middle East', lat: 32.4, lon: 53.7, aliases: ['iran'] },
  { name: 'Israel and Palestine', region: 'Middle East', lat: 31.9, lon: 35.1, aliases: ['israel', 'palestine', 'gaza'] },
  { name: 'Russia', region: 'Europe', lat: 58, lon: 56, aliases: ['russia', 'moscow', 'khabarovsk', 'kostroma'] },
  { name: 'Italy', region: 'Europe', lat: 42.9, lon: 12.6, aliases: ['italy'] },
  { name: 'Spain', region: 'Europe', lat: 40.4, lon: -3.7, aliases: ['spain', 'madrid'] },
  { name: 'France', region: 'Europe', lat: 46.2, lon: 2.2, aliases: ['france'] },
  { name: 'Denmark', region: 'Europe', lat: 56.3, lon: 9.5, aliases: ['denmark'] },
  { name: 'United Kingdom', region: 'Europe', lat: 55.4, lon: -3.4, aliases: ['united kingdom', ' uk '] },
  { name: 'Ukraine', region: 'Europe', lat: 49, lon: 31, aliases: ['ukraine'] },
  { name: 'Democratic Republic of the Congo', region: 'Africa', lat: -2.9, lon: 23.7, aliases: ['democratic republic of the congo', 'dr congo', 'drc', 'congo'] },
  { name: 'Nigeria', region: 'Africa', lat: 9.1, lon: 8.7, aliases: ['nigeria'] },
  { name: 'Guinea', region: 'Africa', lat: 9.9, lon: -9.7, aliases: ['guinea'] },
  { name: 'Ethiopia', region: 'Africa', lat: 9.1, lon: 40.5, aliases: ['ethiopia'] },
  { name: 'Botswana', region: 'Africa', lat: -22.3, lon: 24.7, aliases: ['botswana'] },
  { name: 'Madagascar', region: 'Africa', lat: -18.8, lon: 46.9, aliases: ['madagascar'] },
  { name: 'Zambia', region: 'Africa', lat: -13.1, lon: 27.8, aliases: ['zambia'] },
  { name: 'Zimbabwe', region: 'Africa', lat: -19, lon: 29.2, aliases: ['zimbabwe'] },
  { name: 'Somalia', region: 'Africa', lat: 5.2, lon: 46.2, aliases: ['somalia'] },
  { name: 'Sudan', region: 'Africa', lat: 12.9, lon: 30.2, aliases: ['sudan'] },
  { name: 'South Sudan', region: 'Africa', lat: 7.9, lon: 30.2, aliases: ['south sudan'] },
  { name: 'Burundi', region: 'Africa', lat: -3.4, lon: 29.9, aliases: ['burundi'] },
  { name: 'Cameroon', region: 'Africa', lat: 5.7, lon: 12.7, aliases: ['cameroon'] },
  { name: 'Senegal', region: 'Africa', lat: 14.5, lon: -14.5, aliases: ['senegal'] },
  { name: 'Mauritania', region: 'Africa', lat: 21, lon: -10.9, aliases: ['mauritania'] },
  { name: 'Cabo Verde', region: 'Africa', lat: 16, lon: -24, aliases: ['cabo verde', 'cape verde'] },
  { name: 'Morocco', region: 'Africa', lat: 31.8, lon: -7.1, aliases: ['morocco'] },
  { name: 'Australia', region: 'Pacific', lat: -25.7, lon: 134.5, aliases: ['australia'] },
  { name: 'New Zealand', region: 'Pacific', lat: -40.9, lon: 174.9, aliases: ['new zealand'] },
  { name: 'Vanuatu', region: 'Pacific', lat: -15.4, lon: 166.9, aliases: ['vanuatu'] },
  { name: 'Tonga', region: 'Pacific', lat: -21.2, lon: -175.2, aliases: ['tonga'] },
  { name: 'French Polynesia', region: 'Pacific', lat: -17.7, lon: -149.4, aliases: ['french polynesia'] },
  { name: 'Mayotte', region: 'Africa', lat: -12.8, lon: 45.2, aliases: ['mayotte'] },
  { name: 'Worldwide', region: 'Global', lat: 14, lon: 12, aliases: ['worldwide', 'global', 'multi-country', 'world'] },
];

const DISEASE_PATTERNS: [string, string[]][] = [
  ['African swine fever', ['african swine fever', 'asf']],
  ['Antimicrobial resistance', ['antimicrobial resistance', 'antimicrobial stewardship', 'drug resistance', 'multidrug-resistant']],
  ['Avian influenza', ['avian influenza', 'h5n1', 'h5n5', 'h9n2']],
  ['Bovine tuberculosis', ['bovine tuberculosis']],
  ['Chikungunya', ['chikungunya']],
  ['Cholera', ['cholera']],
  ['Ciguatera fish poisoning', ['ciguatera']],
  ['Dengue', ['dengue']],
  ['Diphtheria', ['diphtheria']],
  ['Ebola', ['ebola']],
  ['E. coli', ['e. coli', 'escherichia coli']],
  ['Foodborne illness', ['foodborne illness', 'food poisoning']],
  ['Foot-and-mouth disease', ['foot & mouth', 'foot-and-mouth']],
  ['Gastroenteritis', ['gastroenteritis']],
  ['Hantavirus', ['hantavirus']],
  ['Hepatitis', ['hepatitis']],
  ['Influenza', ['influenza', 'seasonal influenza']],
  ['Legionellosis', ['legionellosis']],
  ['Leishmaniasis', ['leishmaniasis']],
  ['Malaria', ['malaria']],
  ['Marburg', ['marburg']],
  ['Measles', ['measles']],
  ['Meningococcal disease', ['meningococcal', 'meningitis']],
  ['Mpox', ['mpox', 'monkeypox']],
  ['Middle East respiratory syndrome coronavirus', ['middle east respiratory syndrome', 'mers-cov', 'mers']],
  ['Nipah virus', ['nipah']],
  ['Oropouche', ['oropouche']],
  ['Pertussis', ['pertussis']],
  ['Plague', ['plague']],
  ['Polio', ['polio']],
  ['Rabies', ['rabies']],
  ['Rift Valley fever', ['rift valley fever']],
  ['Rocky Mountain spotted fever', ['rocky mountain spotted fever']],
  ['Salmonella', ['salmonella', 'salmonellosis']],
  ['Tick-borne disease', ['tick-borne', 'lyme disease']],
  ['Tuberculosis', ['tuberculosis', ' tb ']],
  ['Yellow fever', ['yellow fever']],
  ['Zika', ['zika']],
];

function detectSeverity(text: string): Severity {
  const lower = text.toLowerCase();
  if (HIGH_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'high';
  if (MEDIUM_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'medium';
  return 'low';
}

function includesLocation(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(text);
}

function extractRegion(text: string): string {
  const lower = text.toLowerCase();
  for (const [region, keywords] of REGION_MAP) {
    if (keywords.some((keyword) => includesLocation(lower, keyword))) return region;
  }
  return 'Global';
}

function findLocation(
  text: string,
  fallbackRegion = 'Global'
): { location: string; region: string; coordinates: Coordinates } {
  const lower = text.toLowerCase();
  let matched: (typeof LOCATION_POINTS)[number] | undefined;
  let matchedScore = 0;

  for (const point of LOCATION_POINTS) {
    for (const alias of point.aliases) {
      if (includesLocation(lower, alias) && alias.length > matchedScore) {
        matched = point;
        matchedScore = alias.length;
      }
    }
  }

  if (matched) {
    return {
      location: matched.name,
      region: matched.region,
      coordinates: { lat: matched.lat, lon: matched.lon },
    };
  }

  const region = fallbackRegion && fallbackRegion !== 'Global' ? fallbackRegion : extractRegion(text);
  const coordinates = REGION_POINTS[region] || REGION_POINTS.Global;

  return {
    location: region,
    region,
    coordinates,
  };
}

function detectDisease(title: string, text: string): string {
  const lower = ` ${title} ${text} `.toLowerCase();
  const matched = DISEASE_PATTERNS.find(([, aliases]) =>
    aliases.some((alias) => lower.includes(alias))
  );

  if (matched) return matched[0];

  const cleaned = title
    .replace(/^level\s+\d+\s*-\s*/i, '')
    .replace(/^(world|global|country list)\s*:\s*/i, '')
    .replace(/^[a-z][a-z .()'-]{2,45}:\s*/i, '')
    .replace(/^disease outbreak news\s*:\s*/i, '')
    .split(/\s[-–]\s|:|,/)[0]
    .replace(/\([^)]*\)/g, '')
    .trim();

  return cleaned || 'Undifferentiated signal';
}

function parseNumericCount(value: string): number {
  const normalized = value.replace(/[,\s]/g, '');
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractCounts(text: string): { caseCount?: number; deathCount?: number } {
  const caseMatches = Array.from(
    text.matchAll(/(\d[\d,\s]*)\s+(?:confirmed|suspected|probable|reported|new|total|human|laboratory-confirmed|lab-confirmed)?\s*(?:cases|case)\b/gi)
  ).map((match) => parseNumericCount(match[1]));
  const deathMatches = Array.from(
    text.matchAll(/(\d[\d,\s]*)\s+(?:reported|confirmed|additional|total)?\s*(?:deaths|death|fatalities|fatality)\b/gi)
  ).map((match) => parseNumericCount(match[1]));

  return {
    caseCount: caseMatches.length ? Math.max(...caseMatches) : undefined,
    deathCount: deathMatches.length ? Math.max(...deathMatches) : undefined,
  };
}

function enrichSignal(
  signal: SignalBase,
  analysisText: string,
  locationHint?: string,
  coordinateHint?: Coordinates
): Signal {
  const locationText = `${locationHint || ''} ${signal.title} ${analysisText}`;
  const titleLocation = findLocation(signal.title, signal.region);
  const textLocation = findLocation(locationText, signal.region);
  const detectedLocation = titleLocation.location !== signal.region && titleLocation.location !== 'Global'
    ? titleLocation
    : textLocation;
  const location = coordinateHint
    ? { ...detectedLocation, coordinates: coordinateHint }
    : detectedLocation;
  const counts = extractCounts(`${signal.title} ${analysisText}`);

  return {
    ...signal,
    region: location.region,
    disease: detectDisease(signal.title, analysisText),
    location: location.location,
    coordinates: location.coordinates,
    ...counts,
  };
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, length = 700): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trim()}...`;
}

function safeDate(value?: string): string {
  if (!value) return new Date().toISOString();
  const normalized = value.startsWith('$D') ? value.slice(2) : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function generateId(source: string, index: number, title: string): string {
  const hash = Array.from(title).reduce(
    (acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0,
    0
  );
  return `${source.toLowerCase()}-${index}-${Math.abs(hash).toString(36)}`;
}

async function fetchText(url: string, accept?: string): Promise<string> {
  const res = await fetch(url, {
    headers: { ...REQUEST_HEADERS, ...(accept ? { Accept: accept } : {}) },
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

function itemText(item: Parser.Item & Record<string, unknown>): string {
  return String(
    item.contentEncoded ||
      item.content ||
      item.contentSnippet ||
      item.summary ||
      item.title ||
      ''
  );
}

function normalizeRssItem(
  source: Source,
  index: number,
  item: Parser.Item,
  fallbackUrl: string
): Signal {
  const raw = item as Parser.Item & Record<string, unknown>;
  const description = truncate(stripHtml(itemText(raw)) || 'No description available.');
  const text = `${item.title || ''} ${description}`;

  return enrichSignal({
    id: generateId(source, index, item.title || ''),
    title: item.title || `${source} Signal`,
    description,
    url: item.link || fallbackUrl,
    publishedAt: safeDate(item.isoDate || String(raw.dcDate || '') || item.pubDate),
    source,
    severity: detectSeverity(text),
    region: extractRegion(text),
  }, text);
}

async function fetchCDC(): Promise<FeedResult> {
  try {
    const xml = await fetchText(
      'https://wwwnc.cdc.gov/travel/rss/notices.xml',
      'application/rss+xml, application/xml'
    );
    const feed = await parser.parseString(xml);
    const signals = (feed.items || [])
      .slice(0, 20)
      .map((item, index) => normalizeRssItem('CDC', index, item, 'https://www.cdc.gov/'));

    return { signals, ok: signals.length > 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SENTINEL] CDC feed error:', message);
    return { signals: [], ok: false, error: message };
  }
}

interface WhoDonItem {
  DonId?: string;
  Title?: string;
  OverrideTitle?: string;
  Summary?: string;
  Overview?: string;
  PublicationDateAndTime?: string;
  PublicationDate?: string;
  ItemDefaultUrl?: string;
  UrlName?: string;
}

async function fetchWHO(): Promise<FeedResult> {
  try {
    const url =
      'https://cms.who.int/api/hubs/diseaseoutbreaknews' +
      '?$top=20&$orderby=PublicationDateAndTime%20desc';
    const json = (await fetch(url, {
      headers: { ...REQUEST_HEADERS, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 300 },
    }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} from WHO`);
      return res.json();
    })) as { value?: WhoDonItem[] };

    const signals = (json.value || []).map((item, index) => {
      const title = item.OverrideTitle || item.Title || 'WHO Disease Outbreak News';
      const description = truncate(
        stripHtml(item.Summary || item.Overview || '') || 'No description available.'
      );
      const slug = item.UrlName || item.DonId || item.ItemDefaultUrl?.replace(/^\//, '');
      const url = slug
        ? `https://www.who.int/emergencies/disease-outbreak-news/item/${slug}`
        : 'https://www.who.int/emergencies/disease-outbreak-news';
      const text = `${title} ${description}`;

      return enrichSignal({
        id: generateId('who', index, title),
        title,
        description,
        url,
        publishedAt: safeDate(item.PublicationDateAndTime || item.PublicationDate),
        source: 'WHO' as Source,
        severity: detectSeverity(text),
        region: extractRegion(text),
      }, text);
    });

    return { signals, ok: signals.length > 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SENTINEL] WHO feed error:', message);
    return { signals: [], ok: false, error: message };
  }
}

interface ProMedEmbeddedPost {
  alert_id?: number;
  post_title?: string;
  generated_summary?: string;
  issue_date?: string;
  date_created?: string;
  places?: {
    name?: string;
    country?: string;
    lat?: number;
    lon?: number;
    location?: { continent?: string; country?: string };
  }[];
}

function parseProMedEmbeddedPosts(html: string): ProMedEmbeddedPost[] {
  const posts: ProMedEmbeddedPost[] = [];
  const seen = new Set<number | string>();
  const pattern =
    /\\"post_title\\":\\"(.*?)\\",\\"date_created\\":\\"(.*?)\\",\\"alert_id\\":(\d+),\\"issue_date\\":\\"(.*?)\\"/g;
  const matches = Array.from(html.matchAll(pattern));

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const [, title, created, id, issue] = match;
    if (!title || !id || seen.has(id)) continue;
    seen.add(id);

    const nextIndex = matches[index + 1]?.index ?? html.length;
    const block = html.slice(match.index ?? 0, nextIndex);
    const summary = block.match(/\\"generated_summary\\":\\"(.*?)\\",\\"feed_id\\"/)?.[1];
    const place = block.match(/\\"country\\":\\"([^\\"]*)\\"/)?.[1];
    const continent = block.match(/\\"continent\\":\\"([^\\"]*)\\"/)?.[1];
    const lon = Number(block.match(/\\"lon\\":(-?\d+(?:\.\d+)?)/)?.[1]);
    const lat = Number(block.match(/\\"lat\\":(-?\d+(?:\.\d+)?)/)?.[1]);

    posts.push({
      alert_id: Number(id),
      post_title: unescapeJsonString(title),
      generated_summary: summary ? unescapeJsonString(summary) : undefined,
      issue_date: issue,
      date_created: created,
      places: [{
        country: place ? unescapeJsonString(place) : undefined,
        lat: Number.isFinite(lat) ? lat : undefined,
        lon: Number.isFinite(lon) ? lon : undefined,
        location: { continent },
      }],
    });
  }

  return posts;
}

function parseProMedTable(html: string): ProMedEmbeddedPost[] {
  const rows: ProMedEmbeddedPost[] = [];
  const pattern =
    /<td[^>]*>\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\w+\s+\d{2}\s+\d{4})\s*<\/td>\s*<td[^>]*>\s*<div class="font-medium">(.*?)<\/div>/g;

  for (const match of html.matchAll(pattern)) {
    const title = stripHtml(match[2] || '');
    if (!title) continue;
    rows.push({
      post_title: title,
      generated_summary: 'Latest ProMED alert from the public dashboard.',
      issue_date: match[1],
    });
  }

  return rows;
}

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\u003e/g, '>')
    .replace(/\\u003c/g, '<')
    .replace(/\\u0026/g, '&')
    .replace(/\\n/g, ' ')
    .replace(/\\\\/g, '\\');
}

async function fetchProMED(): Promise<FeedResult> {
  try {
    const html = await fetchText('https://www.promedmail.org/', 'text/html');
    const posts = parseProMedEmbeddedPosts(html);
    const fallbackRows = posts.length > 0 ? posts : parseProMedTable(html);

    const signals = fallbackRows.slice(0, 20).map((post, index) => {
      const title = post.post_title || 'ProMED Alert';
      const primaryPlace = post.places?.find((place) => place.lat !== undefined && place.lon !== undefined);
      const placeText = (post.places || [])
        .map((place) => place.country || place.name || place.location?.country || place.location?.continent)
        .filter(Boolean)
        .join(', ');
      const description = truncate(
        stripHtml(post.generated_summary || `ProMED alert for ${placeText || 'global monitoring'}.`)
      );
      const text = `${title} ${description} ${placeText}`;

      const coordinateHint = primaryPlace && !/worldwide|global/i.test(placeText)
        ? { lat: primaryPlace.lat!, lon: primaryPlace.lon! }
        : undefined;

      return enrichSignal({
        id: generateId('promed', index, `${post.alert_id || index}-${title}`),
        title,
        description,
        url: post.alert_id
          ? `https://www.promedmail.org/alerts/${post.alert_id}`
          : 'https://www.promedmail.org/',
        publishedAt: safeDate(post.issue_date || post.date_created),
        source: 'ProMED' as Source,
        severity: detectSeverity(text),
        region: extractRegion(placeText || text),
      }, text, placeText, coordinateHint);
    });

    return { signals, ok: signals.length > 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SENTINEL] ProMED feed error:', message);
    return { signals: [], ok: false, error: message };
  }
}

interface ReliefWebReport {
  id: string;
  fields: {
    title?: string;
    body?: string;
    'body-html'?: string;
    date?: { created?: string; original?: string };
    url?: string;
    url_alias?: string;
    country?: { name: string }[];
  };
}

async function fetchReliefWebApi(): Promise<Signal[]> {
  const params = new URLSearchParams({
    appname: 'sentinel',
    limit: '15',
    preset: 'latest',
    'query[value]': 'disease outbreak situation report health cholera epidemic',
    'filter[field]': 'format.name',
    'filter[value]': 'Situation Report',
  });

  [
    'title',
    'date',
    'url',
    'country',
    'body',
    'body-html',
  ].forEach((field) => params.append('fields[include][]', field));

  const res = await fetch(`https://api.reliefweb.int/v2/reports?${params.toString()}`, {
    headers: { ...REQUEST_HEADERS, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`ReliefWeb API HTTP ${res.status}`);
  const json = (await res.json()) as { data?: ReliefWebReport[] };

  return (json.data || []).map((item, index) => {
    const fields = item.fields;
    const title = fields.title || 'ReliefWeb Situation Report';
    const countryText = (fields.country || []).map((country) => country.name).join(', ');
    const description = truncate(stripHtml(fields.body || fields['body-html'] || ''));
    const text = `${title} ${description} ${countryText}`;

    return enrichSignal({
      id: generateId('reliefweb', index, title),
      title,
      description: description || 'No description available.',
      url: fields.url || fields.url_alias || `https://reliefweb.int/node/${item.id}`,
      publishedAt: safeDate(fields.date?.created || fields.date?.original),
      source: 'ReliefWeb' as Source,
      severity: detectSeverity(text),
      region: extractRegion(countryText || text),
    }, text, countryText);
  });
}

async function fetchReliefWebRss(): Promise<Signal[]> {
  const res = await fetch(
    'https://reliefweb.int/updates/rss.xml?search=disease%20outbreak%20situation%20report',
    {
      headers: {
        Accept: 'application/rss+xml, application/xml',
        'User-Agent': 'curl/8.7.1',
      },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) throw new Error(`ReliefWeb RSS HTTP ${res.status}`);
  const xml = await res.text();
  const feed = await parser.parseString(xml);
  return (feed.items || [])
    .slice(0, 15)
    .map((item, index) =>
      normalizeRssItem('ReliefWeb', index, item, 'https://reliefweb.int/updates')
    );
}

async function fetchReliefWeb(): Promise<FeedResult> {
  try {
    let signals: Signal[];
    try {
      signals = await fetchReliefWebApi();
    } catch {
      signals = await fetchReliefWebRss();
    }

    return { signals, ok: signals.length > 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SENTINEL] ReliefWeb source error:', message);
    return { signals: [], ok: false, error: message };
  }
}

async function fetchPAHO(): Promise<FeedResult> {
  try {
    const xml = await fetchText('https://www.paho.org/en/rss.xml', 'application/rss+xml, application/xml');
    const feed = await parser.parseString(xml);
    const signals = (feed.items || [])
      .slice(0, 20)
      .map((item, index) => normalizeRssItem('PAHO' as Source, index, item, 'https://www.paho.org/'));
    return { signals, ok: signals.length > 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SENTINEL] PAHO feed error:', message);
    return { signals: [], ok: false, error: message };
  }
}

async function fetchOutbreakNews(): Promise<FeedResult> {
  try {
    const xml = await fetchText('https://outbreaknewstoday.com/feed/', 'application/rss+xml, application/xml');
    const feed = await parser.parseString(xml);
    const signals = (feed.items || [])
      .slice(0, 20)
      .map((item, index) => normalizeRssItem('OutbreakNews' as Source, index, item, 'https://outbreaknewstoday.com/'));
    return { signals, ok: signals.length > 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SENTINEL] OutbreakNews feed error:', message);
    return { signals: [], ok: false, error: message };
  }
}

export async function fetchAllSignals(): Promise<SignalsResponse> {
  const [cdcR, whoR, promedR, reliefwebR, pahoR, outbreakR] = await Promise.allSettled([
    fetchCDC(),
    fetchWHO(),
    fetchProMED(),
    fetchReliefWeb(),
    fetchPAHO(),
    fetchOutbreakNews(),
  ]);

  const cdc        = cdcR.status       === 'fulfilled' ? cdcR.value       : { signals: [], ok: false };
  const who        = whoR.status       === 'fulfilled' ? whoR.value       : { signals: [], ok: false };
  const promed     = promedR.status    === 'fulfilled' ? promedR.value    : { signals: [], ok: false };
  const reliefweb  = reliefwebR.status === 'fulfilled' ? reliefwebR.value : { signals: [], ok: false };
  const paho       = pahoR.status      === 'fulfilled' ? pahoR.value      : { signals: [], ok: false };
  const outbreakNews = outbreakR.status === 'fulfilled' ? outbreakR.value : { signals: [], ok: false };

  const allSignals = [
    ...cdc.signals,
    ...who.signals,
    ...promed.signals,
    ...reliefweb.signals,
    ...paho.signals,
    ...outbreakNews.signals,
  ].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return {
    signals: allSignals,
    lastUpdated: new Date().toISOString(),
    sourceStatus: {
      CDC:          cdc.ok          ? 'ok' : 'error',
      WHO:          who.ok          ? 'ok' : 'error',
      ProMED:       promed.ok       ? 'ok' : 'error',
      ReliefWeb:    reliefweb.ok    ? 'ok' : 'error',
      PAHO:         paho.ok         ? 'ok' : 'error',
      OutbreakNews: outbreakNews.ok ? 'ok' : 'error',
    },
  };
}
