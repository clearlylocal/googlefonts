// To escape a character as code point means to create a string of "\" (U+005C), followed by the Unicode code point as the smallest possible number of hexadecimal digits in the range 0-9 a-f (U+0030 to U+0039 and U+0061 to U+0066) to represent the code point in base 16, followed by a single SPACE (U+0020).
const escapeAsCodePoint = (char: string) =>
	`\\${char.codePointAt(0)!.toString(16)} `
const escapeChar = (char: string) => '\\' + char

const escapeAsString = (quoteType: 'single' | 'double' = 'single') => {
	const quot = quoteType === 'double' ? '"' : "'"

	const re1 = new RegExp(`[${quot}\\\\]`, 'g')
	const re2 = /[\r\n]/g

	return (str: string) =>
		quot +
		str.replaceAll(re1, escapeChar).replaceAll(re2, escapeAsCodePoint) +
		quot
}

const escape = (str: string) =>
	[...str]
		.map((char, i, a) => {
			// If the character is NULL (U+0000), then the REPLACEMENT CHARACTER (U+FFFD).
			if (char === '\0') return '\ufffd'
			// If the character is in the range [\1-\1f] (U+0001 to U+001F) or is U+007F, then the character escaped as code point.
			if (/[\x01-\x1f\x7f]/.test(char)) {
				return escapeAsCodePoint(char)
			}
			// If the character is the first character and is in the range [0-9] (U+0030 to U+0039), then the character escaped as code point.
			if (!i && /\d/.test(char)) {
				return escapeAsCodePoint(char)
			}
			// If the character is the second character and is in the range [0-9] (U+0030 to U+0039) and the first character is a "-" (U+002D), then the character escaped as code point.
			if (i === 1 && /\d/.test(char) && a[0] === '-') {
				return escapeAsCodePoint(char)
			}
			// If the character is the first character and is a "-" (U+002D), and there is no second character, then the escaped character.
			if (char === '-' && a.length === 1) {
				return escapeAsCodePoint(char)
			}
			// If the character is not handled by one of the above rules and is greater than or equal to U+0080, is "-" (U+002D) or "_" (U+005F), or is in one of the ranges [0-9] (U+0030 to U+0039), [A-Z] (U+0041 to U+005A), or \[a-z] (U+0061 to U+007A), then the character itself.
			if (char.codePointAt(0)! >= 0x80 || /[-_0-9A-Za-z]/.test(char)) {
				return char
			}
			// Otherwise, the escaped character.
			return escapeChar(char)
		})
		.join('')

export const CSS = { escape }
export { escapeAsString }
