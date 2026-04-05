export interface MatchOdds {
  id: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  odds: {
    home: number
    draw: number
    away: number
  }
}

// Base odds for mock matches — fluctuate slightly on each call to simulate live movement
const MOCK_BASE: MatchOdds[] = [
  {
    id: 'mock-ars-che',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    commenceTime: new Date(Date.now() + 3_600_000).toISOString(),
    odds: { home: 2.10, draw: 3.40, away: 3.20 },
  },
  {
    id: 'mock-mci-mun',
    homeTeam: 'Manchester City',
    awayTeam: 'Manchester United',
    commenceTime: new Date(Date.now() + 7_200_000).toISOString(),
    odds: { home: 1.70, draw: 3.80, away: 4.50 },
  },
  {
    id: 'mock-liv-tot',
    homeTeam: 'Liverpool',
    awayTeam: 'Tottenham',
    commenceTime: new Date(Date.now() + 10_800_000).toISOString(),
    odds: { home: 1.90, draw: 3.60, away: 3.80 },
  },
  {
    id: 'mock-new-bri',
    homeTeam: 'Newcastle',
    awayTeam: 'Brighton',
    commenceTime: new Date(Date.now() + 14_400_000).toISOString(),
    odds: { home: 2.30, draw: 3.20, away: 3.10 },
  },
]

// Shape of a single event returned by the-odds-api.com v4
interface OddsApiOutcome {
  name: string
  price: number
}

interface OddsApiMarket {
  key: string
  outcomes: OddsApiOutcome[]
}

interface OddsApiBookmaker {
  markets: OddsApiMarket[]
}

interface OddsApiEvent {
  id: string
  home_team: string
  away_team: string
  commence_time: string
  bookmakers: OddsApiBookmaker[]
}

export class OddsService {
  constructor(private readonly apiKey: string | null) {}

  async getLiveOdds(): Promise<MatchOdds[]> {
    if (this.apiKey) {
      try {
        return await this.fetchFromApi()
      } catch {
        // API unavailable — fall through to mock
      }
    }
    return this.getMockOdds()
  }

  private async fetchFromApi(): Promise<MatchOdds[]> {
    const url =
      `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/` +
      `?apiKey=${this.apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Odds API responded ${res.status}`)

    const events = (await res.json()) as OddsApiEvent[]
    return events.map(mapApiEvent).slice(0, 10) // cap at 10 matches per response
  }

  private getMockOdds(): MatchOdds[] {
    return MOCK_BASE.map((match) => ({
      ...match,
      odds: {
        home: fluctuate(match.odds.home),
        draw: fluctuate(match.odds.draw),
        away: fluctuate(match.odds.away),
      },
    }))
  }
}

/** Apply a small random movement (±5%) to simulate live odds changes */
function fluctuate(base: number): number {
  const delta = (Math.random() - 0.5) * 0.1
  return Math.round((base + delta) * 100) / 100
}

function mapApiEvent(event: OddsApiEvent): MatchOdds {
  const bookmaker = event.bookmakers[0]
  const outcomes = bookmaker?.markets.find((m) => m.key === 'h2h')?.outcomes ?? []

  return {
    id: event.id,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    commenceTime: event.commence_time,
    odds: {
      home: outcomes.find((o) => o.name === event.home_team)?.price ?? 2.0,
      draw: outcomes.find((o) => o.name === 'Draw')?.price ?? 3.0,
      away: outcomes.find((o) => o.name === event.away_team)?.price ?? 2.0,
    },
  }
}
