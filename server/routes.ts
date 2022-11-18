import { Application } from 'https://deno.land/x/oak@v11.1.0/application.ts'
import { Router } from 'https://deno.land/x/oak@v11.1.0/router.ts'
import { time } from '../utils/time.ts'
import { getDemoHtml } from './getDemoHtml.ts'

// ensure dotenv configured first
await new Promise<void>((res) => setTimeout(res, 0))

const ownBaseUrl = Deno.env.get('BASE_URL')!

const googleFontsBaseUrl = 'https://fonts.gstatic.com'

type FontFace = {
	family: string
	styles: string
}

// special value for `nonce` query param
const REFRESH = 'refresh()'

const cjks = ['SC', 'TC', 'HK', 'JP', 'KR'].map((x) => `Noto Sans ${x}`)
const specifieds = Object.fromEntries(
	[...cjks, 'Noto Color Emoji'].map((k, i, a) => [k, a.length - i]),
)

// -Infinity = exclude
// otherwise, higher = better
const priority = ({ family }: FontFace) => {
	const n = specifieds[family]

	if (n) {
		return n
	}

	if (family === 'Noto Sans') {
		return Infinity
	}

	if (!family.startsWith('Noto Sans')) {
		return -Infinity
	}

	return 0
}

type FontResponseData = {
	status: number
	headers: Headers
	body: Blob
}

const fontResponseCache = new Map<string, FontResponseData>()

export const apiServer = async () => {
	const router = new Router()

	router.get('/', (ctx) => {
		ctx.response.body = 'ok'
	})

	router.get(
		'/demo',
		({
			response,
			request: {
				url: { searchParams },
			},
		}) => {
			response.body = getDemoHtml({ ownBaseUrl, searchParams })
		},
	)

	router.get('/styles/noto.css', async (ctx) => {
		const rawFonts = JSON.parse(
			await Deno.readTextFile('./data/fonts.json'),
		) as FontFace[]
		const fonts = rawFonts
			.map((font) => ({ ...font, priority: priority(font) }))
			.sort((a, b) => b.priority - a.priority)
			.filter(({ priority }) => priority !== -Infinity)

		for (const font of fonts) {
			font.styles = font.styles.replaceAll(
				googleFontsBaseUrl,
				ownBaseUrl + '/fonts',
			)
		}

		const declarations = fonts.map((x) =>
			[`/* === ${x.family} === */`, x.styles].join('\n'),
		)

		let css = declarations.join('\n\n')

		// increases number of fonts requested unnecessarily - not clear why,
		// but disabled for now

		// const unicodeRanges = new Set<string>()

		// css = css
		// 	.replace(
		// 		/\/\*[^*]+\*\/\n@font-face\s*\{\n[^}]*unicode-range:\s*([^;\n}]+)[^}]*\n\}\n?/g,
		// 		(fullMatch, unicodeRange) => {
		// 			if (unicodeRanges.has(unicodeRange)) return ''

		// 			unicodeRanges.add(unicodeRange)

		// 			return fullMatch
		// 		},
		// 	)

		if (ctx.request.url.searchParams.has('merge')) {
			css = css.replace(
				/font-family:\s*'[^']+';/g,
				"font-family: 'Noto Sans';",
			)
		} else {
			css = [
				css,
				[
					'/* === All Noto Fonts === */',
					':root {',
					`  --noto: ${fonts
						.map((x) => `'${x.family}'`)
						.join(', ')};`,
					'}',
				].join('\n'),
			].join('\n\n')
		}

		const display = ctx.request.url.searchParams.get('display')

		if (
			display &&
			['auto', 'block', 'swap', 'fallback', 'optional'].includes(display)
		) {
			css = css.replaceAll(
				'font-display: swap',
				`font-display: ${display}`,
			)
		}

		const nonce = ctx.request.url.searchParams.get('nonce')

		if (nonce) {
			const search = new URLSearchParams({
				nonce:
					nonce === REFRESH ? String(Math.random()).slice(2) : nonce,
			}).toString()

			css = css.replaceAll('.woff2)', `.woff2?${search})`)
		}

		// must be done last
		if (ctx.request.url.searchParams.has('minify')) {
			// very naive algorithm, but for the Google-generated styles, gives
			// identical results to clean-css lib in a fraction of the time

			css = css
				.replace(/\/\*[^*]+\*\//g, '')
				.replace(/\s+/g, ' ')
				.replaceAll('; } ', '}')
				.replaceAll('; ', ';')
				.replaceAll(': ', ':')
				.replaceAll(', ', ',')
				.replaceAll(' { ', '{')
				.trim()
		}

		// headers
		const year = time(1, 'year')

		for (const [k, v] of nonce === REFRESH
			? []
			: [
					['cache-control', `public, max-age=${year.in('seconds')}`],
					[
						'expires',
						new Date(Date.now() + year.in('ms')).toUTCString(),
					],
			  ]) {
			ctx.response.headers.append(k, v)
		}

		ctx.response.type = 'text/css'
		ctx.response.body = css
	})

	router.get('/fonts/:path*', async (ctx) => {
		const url = new URL(
			ctx.params.path + ctx.request.url.search,
			googleFontsBaseUrl,
		).toString()

		let data: FontResponseData
		const cached = fontResponseCache.get(url)

		if (cached) {
			data = cached
		} else {
			const res = await fetch(url)

			const status = res.status
			const headers = res.headers
			const body = await res.blob()

			data = { status, headers, body }

			fontResponseCache.set(url, data)
		}

		ctx.response.status = data.status
		ctx.response.headers = data.headers
		ctx.response.body = data.body
	})

	const app = new Application()

	app.use(router.routes())

	const port = Number(Deno.env.get('PORT') ?? 443)

	console.info(`Listening on port ${port}`)

	await app.listen({ port })
}
