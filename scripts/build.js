const x = await fetch('https://fonts.google.com/metadata/fonts')
const data = await x.json()

const styles = await Promise.all(
	data.familyMetadataList
		.filter((x) => x.isNoto && x.category === 'Sans Serif')
		.map(async (x) => {
			const url = new URL(`https://fonts.googleapis.com/css2`)

			url.searchParams.set('family', x.family)
			url.searchParams.set('display', 'swap')

			const res = await fetch(url)
			const styles = await res.text()

			return { ...x, styles }
		}),
)

// styles

await Deno.writeTextFile('./xyz', JSON.stringify(styles))

console.info(
	[
		...styles.map((x) =>
			[`/* === ${x.family} === */`, x.styles].join('\n'),
		),
		`/* === All Noto Fonts === */
:root {
	--noto-combined: ${styles
		.map((x) => x.family)
		.map((x) => JSON.stringify(x))
		.join(', ')};
}`,
	].join('\n\n'),
)
