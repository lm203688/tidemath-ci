import AppIntents
import Foundation

// TideMath intents stay inside pure astronomy so Spotlight / Siri answers can never disagree
// with the tide table drawn in the app: moon phase is computed here with the same low-precision
// series the JS engine uses, no station data involved.

private let rad = Double.pi / 180

private func norm360(_ x: Double) -> Double {
  let v = x.truncatingRemainder(dividingBy: 360)
  return v < 0 ? v + 360 : v
}

private func centuries(_ date: Date) -> Double {
  let jd = date.timeIntervalSince1970 / 86400 + 2440587.5
  return (jd - 2451545.0) / 36525.0
}

private func moonLongitude(_ date: Date) -> Double {
  let t = centuries(date)
  let L = norm360(218.3164477 + 481267.88123421 * t)
  let D = norm360(297.8501921 + 445267.1114034 * t)
  let m = norm360(357.5291092 + 35999.0502909 * t)
  let mp = norm360(134.9633964 + 477198.8675055 * t)
  let f = norm360(93.272095 + 483202.0175233 * t)
  return norm360(
    L
      + 6.289 * sin(mp * rad)
      + 1.274 * sin((2 * D - mp) * rad)
      + 0.658 * sin(2 * D * rad)
      + 0.214 * sin(2 * mp * rad)
      - 0.186 * sin(m * rad)
      - 0.114 * sin(2 * f * rad)
  )
}

private func sunLongitude(_ date: Date) -> Double {
  let t = centuries(date)
  let l0 = norm360(280.46646 + 36000.76983 * t)
  let m = norm360(357.52911 + 35999.05029 * t)
  let c =
    (1.914602 - 0.004817 * t) * sin(m * rad)
    + (0.019993 - 0.000101 * t) * sin(2 * m * rad)
    + 0.000289 * sin(3 * m * rad)
  return norm360(l0 + c)
}

private func phaseOf(_ date: Date) -> (name: String, illum: Double, elong: Double, springs: Double) {
  let elong = norm360(moonLongitude(date) - sunLongitude(date))
  let illum = (1 - cos(elong * rad)) / 2
  var name = "new moon"
  if elong >= 22.5 && elong < 67.5 { name = "waxing crescent" }
  else if elong >= 67.5 && elong < 112.5 { name = "first quarter" }
  else if elong >= 112.5 && elong < 157.5 { name = "waxing gibbous" }
  else if elong >= 157.5 && elong < 202.5 { name = "full moon" }
  else if elong >= 202.5 && elong < 247.5 { name = "waning gibbous" }
  else if elong >= 247.5 && elong < 292.5 { name = "last quarter" }
  else if elong >= 292.5 && elong < 337.5 { name = "waning crescent" }
  // distance from syzygy in days, using the mean synodic rate: used only as a spring/neap hint
  let fromNew = min(elong, 360 - elong) * 29.53 / 360
  let fromFull = abs(180 - elong) * 29.53 / 360
  return (name, illum, elong, min(fromNew, fromFull))
}

@available(iOS 16.0, *)
struct MoonPhaseIntent: AppIntent {
  static var title: LocalizedStringResource = "Moon phase and spring tides"
  static var description: IntentDescription? = IntentDescription(
    "Reports the moon's phase, illuminated fraction and how far it is from new or full — the fish-feeding windows shift with it."
  )
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Date", description: "Leave empty for right now.")
  var date: Date?

  static var parameterSummary: some ParameterSummary {
    Summary("Moon phase for \(\.$date)")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let when = date ?? Date()
    let p = phaseOf(when)
    let pct = String(format: "%.0f", p.illum * 100)
    let hint: String
    if p.springs < 1.5 { hint = "Spring tide window — expect the biggest tidal range of the month." }
    else if p.springs > 5.3 { hint = "Neap tide window — the range is near its smallest." }
    else { hint = "Mid-cycle — a normal range between spring and neap." }
    return .result(dialog: "\(p.name.capitalized), \(pct)% lit. \(hint)")
  }
}

@available(iOS 16.0, *)
struct OpenTideMathIntent: AppIntent {
  static var title: LocalizedStringResource = "Open TideMath"
  static var description: IntentDescription? = IntentDescription(
    "Opens TideMath's offline tide charts, high and low tables and fishing windows."
  )
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    return .result()
  }
}

@available(iOS 16.0, *)
struct TideMathShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: MoonPhaseIntent(),
      phrases: [
        "What's the moon phase in \(.applicationName)",
        "Spring or neap tide in \(.applicationName)",
      ],
      shortTitle: "Moon phase",
      systemImageName: "moon.stars"
    )
    AppShortcut(
      intent: OpenTideMathIntent(),
      phrases: ["Open \(.applicationName)", "Show today's tides in \(.applicationName)"],
      shortTitle: "Open TideMath",
      systemImageName: "water.waves"
    )
  }
}
