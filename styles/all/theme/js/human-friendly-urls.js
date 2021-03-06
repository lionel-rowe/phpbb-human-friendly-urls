; (() => {
	/**
	 * exposed on `window` by `overall_header_stylesheets_after.html`
	 *
	 * @type {{
	 * 	humanFriendlyUrls: {
	 * 		username: string,
	 * 		userId: number,
	 * 		pageStatus: number,
	 * 		config: {
	 * 			maxSlugLength: number,
	 * 		},
	 * 		l10n: {
	 * 			viewingProfile: string,
	 * 		},
	 * 	},
	 * }}
	 */
	const { humanFriendlyUrls: data } = window
	const { config, l10n } = data

	/** @param {string} str */
	const slugify = (str) => {
		const segments = str
			.normalize()
			.toLowerCase()
			// split on anything other than letters and numbers
			.split(/[^\p{L}\p{N}]+/gu)
			// remove empty or whitespace-only
			.filter((x) => x.trim())

		if (config.maxSlugLength === -1) {
			return segments.join('-')
		}

		// reversing allows us to use `pop` instead of `shift`, which gives
		// massively better performance
		segments.reverse()

		let slug = segments.pop() ?? ''

		/** @type {string} */
		let segment

		while ((segment = segments.pop())) {
			// use LT rather than LTE to account for the joining '-' char
			if (slug.length + segment.length < config.maxSlugLength) {
				slug += '-' + segment
			} else {
				break
			}
		}

		return slug
	}

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
		/** @type {string} */
		let text

		// if .notification-block, grab .notification-reference
		// (.notification-block also contains other text)
		if (link.matches('.notification-block')) {
			text = link
				.querySelector('.notification-reference')
				?.textContent.trim()
		} else {
			const $cloned = link.cloneNode(true)

			// visually hidden elements not canonical for link title generation
			$cloned.querySelectorAll('.sr-only').forEach(($el) => $el.remove())

			const textContent = $cloned.textContent.trim()
			/** @type {string | null} */
			const title = $cloned.title?.trim()

			// use title if textContent is truncated with "???" and title contains full version
			text = title?.startsWith(textContent.slice(0, -1))
				? title
				: textContent
		}

		// hard-coded ??? phpBB never localizes this string;
		// see e.g. /viewtopic.php line 2369
		const rePrefix = 'Re: '
		const reRe = new RegExp(String.raw`^[\p{P}\p{Z}]*${rePrefix}`, 'u')
		const reMatch = text.match(reRe)?.[0]

		return reMatch ? text.slice(reMatch.length) : text
	}

	/** @param {string | null} existingSlug */
	const getCurrentPageTitle = (existingSlug) => {
		if (data.pageStatus >= 400) {
			return ''
		}

		const memberListHeading = document.querySelector('h2.memberlist-title')

		if (memberListHeading) {
			const text = memberListHeading.firstChild.textContent

			const segments = l10n.viewingProfile.split('%s')
			const [before, after] = segments

			return segments.length === 2 &&
				text.startsWith(before) &&
				text.endsWith(after)
				? text.slice(before.length, -after.length || undefined)
				: ''
		}

		const heading = document.querySelector('h2.forum-title, h2.topic-title')

		if (heading) {
			return heading.firstChild.textContent.trim()
		}

		return existingSlug ?? ''
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
		} else if (
			path === 'memberlist' &&
			param === 'u' &&
			id === String(data.userId)
		) {
			slug = slugify(data.username)
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

			if (link.closest('.content, .post-buttons, .skiplink, #quick-links')) {
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

	const url = new URL(window.location.href)

	const sluggableUrlData = getSluggableUrlData(window.location.href)

	if (sluggableUrlData) {
		const slug = slugify(getCurrentPageTitle(sluggableUrlData.existingSlug))

		if (slug) {
			url.href = getHrefFromSlugData(window.location.href, {
				...sluggableUrlData,
				slug,
			})
		}
	}

	// phpBB session ID - only ever used on page load, and should not be part
	// of sharable urls
	url.searchParams.delete('sid')

	if (window.location.href !== url.href) {
		window.history.replaceState(null, '', url.href)
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
