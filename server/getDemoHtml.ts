import { CSS } from '../utils/CSS.ts'

const withSearchParams = (
	href: string,
	params: Record<string, string | undefined>,
) =>
	[
		href,
		new URLSearchParams(
			Object.entries(params).filter(
				([_, v]) => typeof v === 'string',
			) as [string, string][],
		).toString(),
	]
		.filter(Boolean)
		.join('?')

export const getDemoHtml = ({
	ownBaseUrl,
	searchParams,
}: {
	ownBaseUrl: string
	searchParams: URLSearchParams
}) => {
	const { family, display, cssvar, merge, minify } = {
		...{ family: 'Ubuntu' },
		...Object.fromEntries([...searchParams]),
	} as Record<string, string | undefined>

	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<title>Title</title>
		<link rel="stylesheet" href="${withSearchParams(`${ownBaseUrl}/css/css2`, {
			family,
			display,
			minify,
		})}">
		<link rel="stylesheet" href="${withSearchParams(
			`${ownBaseUrl}/noto/combined.css`,
			{ display, merge, cssvar, minify },
		)}">
		<style>
		.demo {
			--font: '${family}', ${
		searchParams.has('merge')
			? 'Noto Sans'
			: `var(--${CSS.escape(
					searchParams.get('cssvar') || 'noto-combined',
			  )})`
	};

			white-space: pre-wrap;
			font-family: var(--font);
			margin-block-end: .5em;
		}
		.below {
			height: 10px;
			background: red;
		}
		</style>
	</head>
	<body>
		<div class="demo">${[
			'AAAAAAAA',
			'ＡＡＡＡＡＡＡＡＡＡＡＡ',
			'<em>Hello</em>, <strong>world</strong>! 🎉',
			'你好，世界！',
		].join('\n')}</div>
		<div class="below"></div>
	</body>
</html>`
}
