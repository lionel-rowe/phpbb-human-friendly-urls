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
 * Human-Friendly URLs ACP module info.
 */
class main_info
{
	public function module()
	{
		return [
			'filename' => '\luoning\humanfriendlyurls\acp\main_module',
			'title' => 'ACP_HUMANFRIENDLYURLS_TITLE',
			'modes' => [
				'settings' => [
					'title' => 'ACP_HUMANFRIENDLYURLS',
					'auth' => 'ext_luoning/humanfriendlyurls && acl_a_board',
					'cat' => ['ACP_HUMANFRIENDLYURLS_TITLE'],
				],
			],
		];
	}
}
