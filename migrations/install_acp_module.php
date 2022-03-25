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

class install_acp_module extends \phpbb\db\migration\migration
{
	public function effectively_installed()
	{
		return isset(
			$this->config['luoning_humanfriendlyurls_max_slug_length']
		);
	}

	public static function depends_on()
	{
		return ['\phpbb\db\migration\data\v320\v320'];
	}

	public function update_data()
	{
		return [
			['config.add', ['luoning_humanfriendlyurls_max_slug_length', 100]],

			[
				'module.add',
				['acp', 'ACP_CAT_DOT_MODS', 'ACP_HUMANFRIENDLYURLS_TITLE'],
			],
			[
				'module.add',
				[
					'acp',
					'ACP_HUMANFRIENDLYURLS_TITLE',
					[
						'module_basename' =>
							'\luoning\humanfriendlyurls\acp\main_module',
						'modes' => ['settings'],
					],
				],
			],
		];
	}
}
