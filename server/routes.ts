import { Application } from 'https://deno.land/x/oak@v11.1.0/application.ts'
import { Router } from 'https://deno.land/x/oak@v11.1.0/router.ts'
import { escapeAsString } from '../utils/CSS.ts'

// ensure dotenv configured first
await new Promise<void>((res) => setTimeout(res, 0))

const ownBaseUrl = Deno.env.get('BASE_URL')

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

export const apiServer = async () => {
	const router = new Router()

	router.get('/', (ctx) => {
		ctx.response.body = 'ok'
	})

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

		const css = [
			...fonts.map((x) =>
				[`/* === ${x.family} === */`, x.styles].join('\n'),
			),
			[
				'/* === All Noto Fonts === */',
				':root {',
				`  --noto: ${fonts
					.map((x) => x.family)
					.map(escapeAsString())
					.join(', ')};`,
				'}',
			].join('\n'),
		].join('\n\n')

		ctx.response.type = 'text/css'
		ctx.response.body = css
	})

	router.get('/fonts/:path*', async (ctx) => {
		const { path } = ctx.params
		const x = path + ctx.request.url.search

		const res = await fetch(new URL(x, googleFontsBaseUrl))

		ctx.response.status = res.status
		ctx.response.headers = res.headers
		ctx.response.body = await res.blob()
	})

	const app = new Application()

	app.use(router.routes())

	const port = Number(Deno.env.get('PORT') ?? 443)

	console.log(`Listening on port ${port}`)

	await app.listen({ port })
}
