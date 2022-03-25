<?php
/**
 *
 * Human-Friendly URLs. An extension for the phpBB Forum Software package.
 *
 * @copyright (c) 2022, Lionel Rowe
 * @license GNU General Public License, version 2 (GPL-2.0)
 *
 */

namespace luoning\humanfriendlyurls\acp;

/**
 * Human-Friendly URLs ACP module.
 */
class main_module
{
	public $page_title;
	public $tpl_name;
	public $u_action;

	/**
	 * Main ACP module
	 *
	 * @param int    $id   The module ID
	 * @param string $mode The module mode (for example: manage or settings)
	 * @throws \Exception
	 */
	public function main($id, $mode)
	{
		global $phpbb_container;

		/** @var \luoning\humanfriendlyurls\controller\acp_controller $acp_controller */
		$acp_controller = $phpbb_container->get(
			'luoning.humanfriendlyurls.controller.acp'
		);

		/** @var \phpbb\language\language $language */
		$language = $phpbb_container->get('language');

		// Load a template from adm/style for our ACP page
		$this->tpl_name = 'acp_humanfriendlyurls_body';

		// Set the page title for our ACP page
		$this->page_title = $language->lang('ACP_HUMANFRIENDLYURLS_TITLE');

		// Make the $u_action url available in our ACP controller
		$acp_controller->set_page_url($this->u_action);

		// Load the display options handle in our ACP controller
		$acp_controller->display_options();
	}
}
