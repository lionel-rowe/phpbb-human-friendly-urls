<?php
/**
 *
 * Human-Friendly URLs. An extension for the phpBB Forum Software package.
 *
 * @copyright (c) 2022, Lionel Rowe, https://github.com/lionel-rowe
 * @license GNU General Public License, version 2 (GPL-2.0)
 *
 */
namespace luoning\humanfriendlyurls\event;

/**
 * @ignore
 */

use phpbb\textformatter\s9e\link_helper;
use s9e\TextFormatter\Parser\Tag;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class main_listener implements EventSubscriberInterface
{
	public static function getSubscribedEvents()
	{
		return [
			'core.page_header' => 'assign_template_vars',
			'core.text_formatter_s9e_render_after' => 'unicodify_urls',
		];
	}

	/* @var \phpbb\config\config */
	protected $config;
	/* @var \phpbb\language\language */
	protected $language;
	/** @var \phpbb\template\template */
	protected $template;
	/** @var \phpbb\user */
	protected $user;

	/* @var string[] */
	protected $default_url_parts;

	/**
	 * Constructor
	 */
	public function __construct(
		\phpbb\config\config $config,
		\phpbb\language\language $language,
		\phpbb\template\template $template,
		\phpbb\user $user
	)
	{
		$this->config = $config;
		$this->language = $language;
		$this->template = $template;
		$this->user = $user;

		// use own instance rather than dependency injection
		// to play nicely with alfredoramos\markdown
		$this->link_helper = new link_helper();

		$this->default_url_parts = array_fill_keys(
			['scheme', 'host', 'port', 'path', 'query', 'fragment'],
			''
		);

		// add necessary language items
		$this->language->add_lang('memberlist');
	}

	/**
	 * Load common language files during user setup
	 */
	public function load_language_on_setup(\phpbb\event\data $event)
	{
		$lang_set_ext = $event['lang_set_ext'];
		$lang_set_ext[] = [
			'ext_name' => 'luoning/humanfriendlyurls',
			'lang_set' => 'common',
		];
		$event['lang_set_ext'] = $lang_set_ext;
	}

	public function assign_template_vars()
	{
		$js_data = [
			// for some reason `username` is HTML-encoded by default
			'username' => html_entity_decode($this->user->data['username']),
			'userId' => intval($this->user->data['user_id']),
			'config' => [
				'maxSlugLength' => intval(
					$this->config['luoning_humanfriendlyurls_max_slug_length']
				),
			],
			'l10n' => [
				'viewingProfile' => $this->language->lang('VIEWING_PROFILE'),
			],
		];

		$this->template->assign_vars([
			// `json_encode` escapes forward-slashes by default, so is safe for
			// direct interpolation inside <script> tags
			'S_SAFE_JS_DATA' => json_encode($js_data, JSON_UNESCAPED_UNICODE),
		]);
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
	 * replace link content with unicode-friendly version
	 */
	protected function replace_link_content(array $link_html_match_arr)
	{
		[
			$full_link_html,
			$start_tag,
			$href_quot,
			$href_apos,
			$text_content,
			$end_tag,
		] = $link_html_match_arr;

		$href = strlen($href_quot) > 0 ? $href_quot : $href_apos;

		$is_external_link_text = in_array($text_content, [
			$href,
			$this->truncate_href($href),
		]);

		$is_local_link_text = in_array($text_content, [
			$this->to_local($href),
			$this->truncate_href($this->to_local($href)),
		]);

		if ($is_external_link_text)
		{
			return $start_tag .
				$this->truncate_href($this->unicodify_url($href)) .
				$end_tag;
		}
		else if ($is_local_link_text)
		{
			return $start_tag .
				$this->truncate_href(
					$this->unicodify_url($this->to_local($href))
				) .
				$end_tag;
		}

		return $full_link_html;
	}

	/**
	 * render pretty Unicode URLs
	 */
	public function unicodify_urls(\phpbb\event\data $event)
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
			([\s\S]+?)                    # text_content
			(<\/a>)                        # end_tag
		/ix';

		$event['html'] = preg_replace_callback(
			$link_matcher,
			[$this, 'replace_link_content'],
			$event['html']
		);
	}
}
