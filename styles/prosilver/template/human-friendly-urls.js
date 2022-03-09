;(() => {
	const slugify = (str) =>
		str
			// split apart diacritics to discard later - removes need for URL encoding where possible
			.normalize('NFKD')
			.toLowerCase()
			// split on punctuation or separators (including spaces)
			.split(/[\p{P}\p{Z}]+/gu)
			// remove non-letters and non-numbers
			.map((x) => x.replace(/[^\p{L}\p{N}]+/gu, ''))
			.join(' ')
			// truncate excessively long slugs to keep URLs within reasonable length
			.slice(0, 100)
			.trim()
			.replace(/ +/gu, '-')

	const mutateUrl = (url, { param, id, slug }) => {
		const integerPart = id.match(/^\d+/)

		if (integerPart) {
			// PHP string conversion to integer discards any non-integer part,
			// so we can safely append the slug with a character that never
			// occurs in the middle of an integer ("-")
			url.searchParams.set(
				param,
				[integerPart, slug].filter(Boolean).join('-'),
			)
		}
	}

	const pathParams = new Map(
		Object.entries({
			viewtopic: ['t', 'p'],
			viewforum: ['f'],
			memberlist: ['u'],
		}),
	)

	// cache both slightly improves perf and allows links with no text content to
	// intelligently grab slug from contentful links on same page
	const slugCache = new Map(
		[...pathParams.entries()].map(([param, ids]) => [
			param,
			new Map(ids.map((id) => [id, new Map()])),
		]),
	)

	const slugCacheGet = ({ path, param, id }) =>
		slugCache.get(path)?.get(param)?.get(id)
	const slugCacheSet = ({ path, param, id }, slug) =>
		slugCache.get(path)?.get(param)?.set(id, slug)

	const generateHrefFromSlugCache = ({ href, path, param, id }) => {
		const url = new URL(href)

		const cached = slugCacheGet({ path, param, id })

		if (cached) {
			mutateUrl(url, { param, id, slug: slugify(cached) })

			return url.href
		}

		return null
	}

	const hasSlug = (id) => /\D/.test(id)

	const getSluggableUrlData = (href) => {
		const url = new URL(href)
		const path = url.pathname.split('/').slice(-1)[0].split('.')[0]
		const params = pathParams.get(path)

		if (!params) {
			return null
		}

		let param
		let id

		for (const p of params) {
			param = p
			id = url.searchParams.get(p)

			if (id) {
				break
			}
		}

		return hasSlug(id) ? null : { path, param, id }
	}

	const getLinkTitle = (link) => {
		// if .notification-block, grab .notification-reference
		// (.notification-block also contains other text)
		if (link.matches('.notification-block')) {
			return link
				.querySelector('.notification-reference')
				?.textContent.trim()
		}

		const textContent = link.textContent.trim()
		const title = link.title?.trim()

		// use title if textContent is truncated with "…" and title contains full version
		return title?.startsWith(textContent.slice(0, -1)) ? title : textContent
	}

	const getCurrentPageTitle = () =>
		document.querySelector('h2[class$="-title"]')?.textContent?.trim()

	const addSlug = (href, title) => {
		const url = new URL(href)

		const { path, param, id } = getSluggableUrlData(href) ?? {}

		if (!id) {
			return
		}

		const cached = generateHrefFromSlugCache({ href, path, param, id })

		if (cached) {
			return cached
		}

		if (!title) {
			return
		}

		let maybeId

		try {
			maybeId = new URL(title, window.location).searchParams.get(param)
		} catch {
			/* text content is not a valid URL */
		}

		// if text content already contains query param, is most likely just the URL itself
		if (maybeId) {
			return
		}

		const slug = slugify(title)

		mutateUrl(url, { param, id, slug })

		slugCacheSet({ path, param, id }, slug)

		return url.href
	}

	const renderSlugForLink = (link) => {
		const href = addSlug(link.href, getLinkTitle(link))

		if (href) {
			link.href = href
		} else {
			// if no text (e.g. is an icon), do a second pass asynchronously
			setTimeout(() => {
				const { path, param, id } = getSluggableUrlData(link.href) ?? {}

				if (id) {
					link.href = generateHrefFromSlugCache({
						href: link.href,
						path,
						param,
						id,
					})
				}
			}, 0)
		}
	}

	const selector = 'a[href]'

	const sluggableUrlData = getSluggableUrlData(window.location.href)

	if (sluggableUrlData) {
		const href = addSlug(window.location.href, getCurrentPageTitle())

		window.history.replaceState({}, document.title, href)
	}

	document.querySelectorAll(selector).forEach(renderSlugForLink)

	// for any elements added later with JavaScript
	document.body.addEventListener('mouseover', (e) => {
		if (e.target.matches(selector)) {
			renderSlugForLink(e.target)
		}
	})
})()
