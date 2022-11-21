import { Application } from 'https://deno.land/x/oak@v11.1.0/application.ts'
import { Router } from 'https://deno.land/x/oak@v11.1.0/router.ts'
import { CSS } from '../utils/CSS.ts'
import { time } from '../utils/time.ts'
import { getDemoHtml } from './getDemoHtml.ts'

// ensure dotenv configured first
await new Promise<void>((res) => setTimeout(res, 0))

const ownBaseUrl = Deno.env.get('BASE_URL')!

const googleCssBaseUrl = 'https://fonts.googleapis.com'
const googleFontsBaseUrl = 'https://fonts.gstatic.com'

type FontFace = {
	family: string
	styles: string
}

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

type ResponseData = {
	status: number
	headers: Headers
	body: Blob
}

type ResponseCache = Map<string, ResponseData>

const cssResponseCache: ResponseCache = new Map()
const fontResponseCache: ResponseCache = new Map()

// very naive algorithm, but for the Google-generated styles, gives identical
// results to `clean-css` lib in a fraction of the time
const minify = (css: string) =>
	(css = css
		.replaceAll(/\/\*[^*]+\*\//g, '')
		.replaceAll(/\s+/g, ' ')
		.replaceAll('; } ', '}')
		.replaceAll('; ', ';')
		.replaceAll(': ', ':')
		.replaceAll(', ', ',')
		.replaceAll(' { ', '{')
		.trim())

const getFromUrlOrCache = async (url: URL, cache: ResponseCache) => {
	const href = url.toString()

	let data: ResponseData
	const cached = cache.get(href)

	if (cached) {
		data = cached
	} else {
		const res = await fetch(href)

		const status = res.status
		const headers = res.headers
		const body = await res.blob()

		data = { status, headers, body }

		cache.set(href, data)
	}

	return data
}

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

	router.get('/css/:path*', async (ctx) => {
		const url = new URL(
			ctx.params.path + ctx.request.url.search,
			googleCssBaseUrl,
		)

		const data = await getFromUrlOrCache(url, cssResponseCache)

		let css = await data.body.text()

		css = css.replaceAll(googleFontsBaseUrl, ownBaseUrl + '/fonts')

		// must be done last
		if (ctx.request.url.searchParams.has('minify')) {
			css = minify(css)
		}

		ctx.response.headers = data.headers
		ctx.response.status = data.status
		ctx.response.body = css
	})

	router.get('/fonts/:path*', async (ctx) => {
		const url = new URL(
			ctx.params.path + ctx.request.url.search,
			googleFontsBaseUrl,
		)

		const data = await getFromUrlOrCache(url, fontResponseCache)

		ctx.response.status = data.status
		ctx.response.headers = data.headers
		ctx.response.body = data.body
	})

	router.get('/noto/combined.css', async (ctx) => {
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

		const cssVar =
			ctx.request.url.searchParams.get('cssvar') || 'noto-combined'

		if (ctx.request.url.searchParams.has('merge')) {
			css = css.replaceAll(
				/font-family:\s*'[^']+';/g,
				"font-family: 'Noto Sans';",
			)
		} else {
			css = [
				css,
				[
					'/* === All Noto Fonts === */',
					':root {',
					`  --${CSS.escape(cssVar)}: ${fonts
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

		// must be done last
		if (ctx.request.url.searchParams.has('minify')) {
			css = minify(css)
		}

		// headers
		const month = time(1, 'month')

		for (const [k, v] of [
			['cache-control', `public, max-age=${month.in('seconds')}`],
			['expires', new Date(Date.now() + month.in('ms')).toUTCString()],
		]) {
			ctx.response.headers.append(k, v)
		}

		ctx.response.type = 'text/css'
		ctx.response.body = css
	})

	const app = new Application()

	app.use(router.routes())

	const port = Number(Deno.env.get('PORT') ?? 443)

	console.info(`Listening on port ${port}`)

	await app.listen({ port })
}
