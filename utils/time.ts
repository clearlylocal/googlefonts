enum Units {
	ms = 1,
	s = ms * 1000,
	m = s * 60,
	h = m * 60,
	D = h * 24,
	M = D * 30,
	Y = D * 365,

	millisecond = ms,
	second = s,
	minute = m,
	hour = h,
	day = D,
	month = M,
	year = Y,

	milliseconds = ms,
	seconds = s,
	minutes = m,
	hours = h,
	days = D,
	months = M,
	years = Y,
}

type Unit = keyof typeof Units

export const time = (num: number, unit: Unit) => {
	const unit1 = unit

	return {
		in: (unit: Unit) => {
			const unit2 = unit

			return (num / Units[unit2]) * Units[unit1]
		},
	}
}
