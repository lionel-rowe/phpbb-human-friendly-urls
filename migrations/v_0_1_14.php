<?php
/**
 *
 * Human-Friendly URLs. An extension for the phpBB Forum Software package.
 *
 * @copyright (c) 2022, Lionel Rowe
 * @license GNU General Public License, version 2 (GPL-2.0)
 *
 */

namespace luoning\humanfriendlyurls\migrations;

class v_0_1_14 extends \phpbb\db\migration\migration
{
	public function effectively_installed()
	{
		return isset(
			$this->config['luoning_humanfriendlyurls_unicodify_links']
		);
	}

	public static function depends_on()
	{
		return ['\luoning\humanfriendlyurls\migrations\install_acp_module'];
	}

	public function update_data()
	{
		return [
			['config.add', ['luoning_humanfriendlyurls_unicodify_links', 1]],
		];
	}
}
