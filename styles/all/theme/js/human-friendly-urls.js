;(() => {
	/** @param {string} str */
	const slugify = (str) =>
		str
			.normalize()
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

	const pathParams = new Map(
		Object.entries({
			viewtopic: ['t', 'p'],
			viewforum: ['f'],
			memberlist: ['u'],
		}),
	)

	/**
	 * @type {Map<string, Map<string, Map<string, string>>>}
	 *
	 * cache both slightly improves perf and allows links with no text content to
	 * intelligently grab slug from contentful links on same page
	 */
	const slugCache = new Map(
		[...pathParams.entries()].map(([param, ids]) => [
			param,
			new Map(ids.map((id) => [id, new Map()])),
		]),
	)

	/** @param {{ path: string, param: string, id: string }} */
	const slugCacheGet = ({ path, param, id }) =>
		slugCache.get(path)?.get(param)?.get(id)

	/**
	 * @param {{ path: string, param: string, id: string }}
	 * @param {string} slug
	 */
	const slugCacheSet = ({ path, param, id }, slug) => {
		slugCache.get(path)?.get(param)?.set(id, slug)
	}

	/**
	 * @param {string} id
	 * @returns {[bareId: string, slug: string | null]}
	 */
	const toBareIdAndSlug = (id) => {
		const [bareId, ...slugSegments] = id.split('-')

		return [bareId, slugSegments.join('-') || null]
	}

	/** @param {string} href */
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

		if (!id) {
			return null
		}

		const [bareId, existingSlug] = toBareIdAndSlug(id)

		if (!bareId || !param) {
			return null
		}

		return { path, param, id: bareId, existingSlug }
	}

	/** @param {HTMLAnchorElement} link */
	const getLinkTitle = (link) => {
		// if .notification-block, grab .notification-reference
		// (.notification-block also contains other text)
		if (link.matches('.notification-block')) {
			return link
				.querySelector('.notification-reference')
				?.textContent.trim()
		}

		const $cloned = link.cloneNode(true)

		// visually hidden elements not canonical for link title generation
		$cloned.querySelectorAll('.sr-only').forEach(($el) => $el.remove())

		const textContent = $cloned.textContent.trim()
		const title = $cloned.title?.trim()

		const text = title?.startsWith(textContent.slice(0, -1)) ? title : textContent

		// hard-coded — phpBB never localizes this string;
		// see e.g. /viewtopic.php line 2369
		const re = 'Re: '

		// use title if textContent is truncated with "…" and title contains full version
		return text.startsWith(re) ? text.slice(re.length) : text
	}

	const getCurrentPageTitle = () => {
		/** @type {HTMLHeadingElement} */
		let heading

		if ((heading = document.querySelector('h2.memberlist-title'))) {
			return heading.textContent.split('-').slice(1).join('-').trim()
		} else if ((heading = document.querySelector('h2[class$="-title"]'))) {
			return heading.textContent.trim()
		}

		return document.title.split('-').slice(1).join('-').trim()
	}

	/**
	 * @typedef {{
	 *	slug: string,
	 *	path: string,
	 *	param: string,
	 *	id: string,
	 * 	existingSlug?: string | null
	 * }} SlugData
	 */

	/**
	 * @param {string} href
	 * @param {string} title
	 *
	 * @returns {?SlugData}
	 */
	const getSlugData = (href, title) => {
		if (!title) {
			return null
		}

		const { path, param, id, existingSlug } =
			getSluggableUrlData(href) ?? {}

		if (![path, param, id].every(Boolean)) {
			return null
		}

		/** @type {?string} */
		let slug

		const cached = slugCacheGet({ path, param, id })

		if (cached) {
			slug = cached
		} else {
			let maybeId

			try {
				maybeId = new URL(title, window.location).searchParams.get(
					param,
				)
			} catch {
				/* text content is not a valid URL */
			}

			// if text content already contains query param, is most likely just the URL itself
			if (maybeId) {
				return null
			}

			if (existingSlug) {
				slug = existingSlug
			} else {
				slug = slugify(title)
			}
		}

		return { slug, path, param, id, existingSlug }
	}

	/**
	 * @param {string} href
	 * @param {SlugData} slugData
	 */
	const getHrefFromSlugData = (href, { param, id, slug }) => {
		const url = new URL(href)

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

		return url.href
	}

	/** @param {HTMLAnchorElement} link */
	const renderSlugForLink = (link) => {
		/** @type {?string} */
		let href

		const slugData = getSlugData(link.href, getLinkTitle(link))

		if (slugData) {
			const { slug, existingSlug } = slugData

			if (link.closest('.content')) {
				if (existingSlug) {
					slugCacheSet(slugData, existingSlug)
				}
			} else {
				href = getHrefFromSlugData(link.href, slugData)
				slugCacheSet(slugData, slug)
			}
		}

		if (href) {
			link.href = href
		} else {
			// if no text (e.g. is an icon) or is in post content,
			// do a second pass asynchronously
			setTimeout(() => {
				const sluggableUrlData = getSluggableUrlData(link.href)

				if (sluggableUrlData) {
					const { path, param, id } = sluggableUrlData

					const cached = slugCacheGet({ path, param, id })

					if (cached) {
						link.href = getHrefFromSlugData(link.href, {
							param,
							id,
							slug: cached,
						})
					}
				}
			}, 0)
		}
	}

	const selector = 'a[href]'

	const sluggableUrlData = getSluggableUrlData(window.location.href)

	if (sluggableUrlData) {
		const slug = slugify(getCurrentPageTitle())
		const href = getHrefFromSlugData(window.location.href, {
			...sluggableUrlData,
			slug,
		})

		if (href !== window.location.href) {
			window.history.replaceState({}, document.title, href)
		}
	}

	document.querySelectorAll(selector).forEach(renderSlugForLink)

	// for any elements added later with JavaScript
	new MutationObserver((mutations) => {
		mutations
			.map((mutation) => mutation.target)
			.filter((node) => node instanceof HTMLElement)
			.flatMap((el) => [el, ...el.querySelectorAll(selector)])
			.filter((el) => el.matches(selector))
			.forEach(renderSlugForLink)
	}).observe(document.body, { childList: true, subtree: true })
})()
