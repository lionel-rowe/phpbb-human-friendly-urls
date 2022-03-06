(() => {
	const slugify = str => str
		// split apart diacritics to discard later - removes need for URL encoding where possible
		.normalize('NFKD')
		.toLowerCase()
		// split on punctuation or separators (including spaces)
		.split(/[\p{P}\p{Z}]+/gu)
		// remove non-letters and non-numbers
		.map(x => x.replace(/[^\p{L}\p{N}]+/gu, ''))
		.join(' ')
		// truncate excessively long slugs to keep URLs within reasonable length
		.slice(0, 100)
		.trim()
		.replace(/ +/gu, '-')

	const setUrlSlug = (url, { param, id, slug }) => {
		const integerPart = id.match(/^\d+/)

		if (integerPart) {
			// PHP string conversion to integer discards any non-integer part,
			// so we can safely append the slug with a character that never
			// occurs in the middle of an integer ("-")
			url.searchParams.set(param, [integerPart, slug].filter(Boolean).join('-'))
		}
	}

	const pathParams = new Map(Object.entries({
		viewtopic: ['t', 'p'],
		viewforum: ['f'],
		memberlist: ['u'],
	}))

	// cache both slightly improves perf and allows links with no text content to
	// intelligently grab slug from contentful links on same page
	const cache = new Map(
		[...pathParams.entries()].map(([param, ids]) => [param, new Map(ids.map(id => [id, new Map()]))]),
	)

	const cacheGet = ({ path, param, id }) => cache.get(path)?.get(param)?.get(id)
	const cacheSet = ({ path, param, id, slug }) => cache.get(path)?.get(param)?.set(id, slug)

	const addSlugFromCache = ({ link, url, path, param, id }) => {
		const cached = cacheGet({ path, param, id })

		if (cached) {
			setUrlSlug(url, { param, id, slug: slugify(cached) })
			link.href = url.href

			return true
		}

		return false
	}

	const getText = link => {
		// if .notification-block, grab .notification-reference (also contains other text)
		if (link.matches('.notification-block')) {
			return link.querySelector('.notification-reference')?.textContent.trim()
		}

		const textContent = link.textContent.trim()
		const title = link.title?.trim()

		// use title if textContent is truncated with "…" and title contains full version
		return title?.startsWith(textContent.slice(0, -1))
			? title
			: textContent
	}

	const addSlug = link => {
		const url = new URL(link.href)
		const path = url.pathname.split('/').slice(-1)[0].split('.')[0]
		const params = pathParams.get(path)

		if (!params) return

		let param
		let id

		for (const p of params) {
			param = p
			id = url.searchParams.get(p)

			if (id) break
		}

		// if id matches /\D/, already has slug
		if (!id || /\D/.test(id)) return

		if (addSlugFromCache({ link, url, path, param, id })) {
			return
		}

		const text = getText(link)

		if (!text) {
			// if no text (e.g. is an icon), do a second pass asynchronously
			setTimeout(() => addSlugFromCache({ link, url, path, param, id }), 0)

			return
		}

		let maybeId

		try {
			maybeId = new URL(text, window.location).searchParams.get(param)
		} catch { /* text content is not a valid URL */ }

		// if text content already contains query param, is most likely just the URL itself
		if (maybeId) return

		const slug = slugify(text)

		setUrlSlug(url, { param, id, slug })
		link.href = url.href

		cacheSet({ path, param, id, slug })
	}

	const selector = 'a[href]'

	document.querySelectorAll(selector).forEach(addSlug)

	// for any elements added later with JavaScript
	document.body.addEventListener('mouseover', e => {
		if (e.target.matches(selector)) {
			addSlug(e.target)
		}
	})
})()
