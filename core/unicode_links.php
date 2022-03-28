<?php
/**
 *
 * Human-Friendly URLs. An extension for the phpBB Forum Software package.
 *
 * @copyright (c) 2022, Lionel Rowe, https://github.com/lionel-rowe
 * @license GNU General Public License, version 2 (GPL-2.0)
 *
 */
namespace luoning\humanfriendlyurls\core;

/**
 * @ignore
 */

use phpbb\textformatter\s9e\link_helper;
use s9e\TextFormatter\Parser\Tag;

class unicode_links
{
	/* @var \phpbb\textformatter\s9e\link_helper */
	protected $link_helper;
	/* @var string[] */
	protected $default_url_parts;

	/**
	 * Constructor
	 */
	public function __construct()
	{
		// use own instance rather than dependency injection
		// to play nicely with alfredoramos\markdown
		$this->link_helper = new link_helper();

		$this->default_url_parts = array_fill_keys(
			['scheme', 'host', 'port', 'path', 'query', 'fragment'],
			''
		);
	}

	/**
	 * render URL in a Unicode-aware way
	 */
	protected function unicodify_url(string $href)
	{
		$url = array_merge($this->default_url_parts, parse_url($href));

		$scheme = $url['scheme'];
		$host = idn_to_utf8($url['host']);
		$port = $url['port'];
		$path = urldecode($url['path']);
		$query = urldecode($url['query']);
		$fragment = urldecode($url['fragment']);

		return implode([
			$scheme ? "$scheme://" : '',
			$host ? $host : '',
			$port ? ":$port" : '',
			$path ? $path : '',
			$query ? "?$query" : '',
			$fragment ? "#$fragment" : '',
		]);
	}

	/**
	 * create a dummy tag to pass to link_helper methods
	 */
	protected function dummy_tag(string $href)
	{
		$tag = new Tag(0, 'url', 0, 0);
		$tag->setAttribute('text', $href);

		return $tag;
	}

	/**
	 * truncate URLs to max 55 chars long
	 */
	protected function truncate_href(string $href)
	{
		$tag = $this->dummy_tag($href);
		$this->link_helper->truncate_text($tag);

		return $tag->getAttribute('text');
	}

	/**
	 * convert full to local URL
	 */
	protected function to_local(string $href)
	{
		$board_url = generate_board_url();
		$tag = $this->dummy_tag($href);
		$this->link_helper->truncate_local_url($tag, $board_url);

		return substr($tag->getAttribute('text'), 1);
	}

	/**
	 * normalize URLs for accurate comparison of e.g. () vs %28%29
	 *
	 * necessary for e.g. Wikipedia URLs such as
	 * https://es.wikipedia.org/wiki/Contrase%C3%B1a_(%C3%A1lbum)
	 * => https://es.wikipedia.org/wiki/Contraseña_(álbum)
	 */
	protected function normalize_url(string $href)
	{
		$chars_to_normalize = str_split('()[]');
		$matcher = implode('|', array_map('urlencode', $chars_to_normalize));

		return preg_replace_callback(
			"/$matcher/",
			function ($match_arr) {
				return urldecode($match_arr[0]);
			},
			$href
		);
	}

	/**
	 * checks if href is the same as text content
	 * optionally with additional formatters to check different variations
	 */
	protected function is_same_url(string $raw_href, string $raw_text_content)
	{
		$identity = function (string $str) {
			return $str;
		};

		return function (
			?callable $fmt_href = null,
			?callable $fmt_text_content = null
		) use ($raw_href, $raw_text_content, $identity) {
			$fmt_href = $fmt_href ?? $identity;
			$fmt_text_content = $fmt_text_content ?? $identity;

			$text_content = $fmt_text_content($raw_text_content);
			$href = $fmt_href($raw_href);

			return $text_content === $href ||
				$text_content === $this->truncate_href($href);
		};
	}

	/**
	 * replace link content with unicode-friendly version
	 */
	protected function replace_link_content(array $link_html_match_arr)
	{
		[
			$full_link_html,
			$start_tag,
			$href_quot,
			$href_apos,
			$inner_html,
			$end_tag,
		] = $link_html_match_arr;

		$raw_href = html_entity_decode(
			!empty($href_quot) ? $href_quot : $href_apos
		);

		$raw_text_content = html_entity_decode($inner_html);

		$is_same_url = $this->is_same_url($raw_href, $raw_text_content);

		$is_external_link_text =
			$is_same_url() ||
			$is_same_url([$this, 'normalize_url'], [$this, 'normalize_url']);

		if ($is_external_link_text)
		{
			return $start_tag .
				htmlspecialchars(
					$this->truncate_href($this->unicodify_url($raw_href))
				) .
				$end_tag;
		}

		$is_local_link_text =
			$is_same_url([$this, 'to_local']) ||
			$is_same_url(
				function ($str) {
					return $this->normalize_url($this->to_local($str));
				},
				[$this, 'normalize_url']
			);

		if ($is_local_link_text)
		{
			return $start_tag .
				htmlspecialchars(
					$this->truncate_href(
						$this->unicodify_url($this->to_local($raw_href))
					)
				) .
				$end_tag;
		}

		return $full_link_html;
	}

	/**
	 * render pretty Unicode URLs
	 */
	public function render_links_for_post(string $html)
	{
		$link_matcher = '/
			(<a			                  # start_tag
				[^>]*
				(?:
					href="([^>"]+)"       # href_quot
					| href=\'([^>\']+)\'  # href_apos
				)
				[^>]*
			>)
			([^<]+?)                      # inner_html
			(<\/a>)                       # end_tag
		/ix';

		return preg_replace_callback(
			$link_matcher,
			[$this, 'replace_link_content'],
			$html
		);
	}
}
