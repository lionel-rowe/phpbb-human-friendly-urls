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

use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class main_listener implements EventSubscriberInterface
{
	public static function getSubscribedEvents()
	{
		return [
			'core.page_header' => 'assign_template_vars',
			'core.text_formatter_s9e_render_after' => 'unicodify_links',
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
	/** @var \luoning\humanfriendlyurls\core\unicode_links */
	protected $unicode_links;

	/**
	 * Constructor
	 */
	public function __construct(
		\phpbb\config\config $config,
		\phpbb\language\language $language,
		\phpbb\template\template $template,
		\phpbb\user $user,
		\luoning\humanfriendlyurls\core\unicode_links $unicode_links
	)
	{
		$this->config = $config;
		$this->language = $language;
		$this->template = $template;
		$this->user = $user;
		$this->unicode_links = $unicode_links;

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

	/**
	 * assign template variables for access via JS
	 */
	public function assign_template_vars()
	{
		$js_data = [
			// for some reason `username` is HTML-encoded by default
			'username' => html_entity_decode($this->user->data['username']),
			'userId' => intval($this->user->data['user_id']),
			'pageStatus' => http_response_code(),
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
	 * render pretty Unicode URLs
	 */
	public function unicodify_links(\phpbb\event\data $event)
	{
		if (!$this->config['luoning_humanfriendlyurls_unicodify_links']) {
			return;
		}

		$event['html'] = $this->unicode_links->render_links_for_post(
			$event['html']
		);
	}
}
