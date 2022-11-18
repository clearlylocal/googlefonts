export const getDemoHtml = ({
	ownBaseUrl,
	searchParams,
}: {
	ownBaseUrl: string
	searchParams: URLSearchParams
}) => `<!DOCTYPE html>
<html lang="en">
	<head>
		<title>Title</title>
		<link rel="stylesheet" href="${ownBaseUrl}/styles/noto.css${((x) =>
	x ? '?' + x : '')(searchParams.toString())}">
		<style>
		.demo {
			white-space: pre-wrap;
			font-family: ${searchParams.has('merge') ? 'Noto Sans' : 'var(--noto)'};
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
