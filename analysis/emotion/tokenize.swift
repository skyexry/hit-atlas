import Foundation
import NaturalLanguage

struct Lyrics: Decodable {
    let version: String
    let lines: [String]
}

struct Word: Encodable {
    let word: String
    let start: Int
    let end: Int
}

struct TokenizedLyrics: Encodable {
    let version: String
    let language: String
    let confidence: Double
    let lines: [[Word]]
}

let decoder = JSONDecoder()
let encoder = JSONEncoder()
while let input = readLine() {
    let lyrics = try decoder.decode(Lyrics.self, from: Data(input.utf8))
    let recognizer = NLLanguageRecognizer()
    recognizer.processString(lyrics.lines.joined(separator: "\n"))
    let probabilities = recognizer.languageHypotheses(withMaximum: 1)
    let language = recognizer.dominantLanguage ?? .undetermined
    let tokenizer = NLTokenizer(unit: .word)
    tokenizer.setLanguage(language)
    let lines = lyrics.lines.map { text -> [Word] in
        tokenizer.string = text
        return tokenizer.tokens(for: text.startIndex..<text.endIndex).map { interval in
            Word(word: String(text[interval]),
                 start: text.unicodeScalars.distance(from: text.startIndex, to: interval.lowerBound),
                 end: text.unicodeScalars.distance(from: text.startIndex, to: interval.upperBound))
        }
    }
    let encoded = try encoder.encode(TokenizedLyrics(
        version: lyrics.version,
        language: language.rawValue,
        confidence: probabilities[language] ?? 0,
        lines: lines
    ))
    print(String(decoding: encoded, as: UTF8.self))
}
