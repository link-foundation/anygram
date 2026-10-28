// Official bootstrap endpoints; refresh account-specific routes with help.getConfig.
// https://github.com/telegramdesktop/tdesktop/blob/f985723b552b30fe1c17d377d57f44e61a15a8c4/Telegram/SourceFiles/mtproto/mtproto_dc_options.cpp
export function dcAddress(dc, test = false) {
  const addresses = test
    ? ['149.154.175.10', '149.154.167.40', '149.154.175.117']
    : [
        '149.154.175.50',
        '149.154.167.51',
        '149.154.175.100',
        '149.154.167.91',
        '149.154.171.5',
      ];
  if (!Number.isInteger(dc) || !addresses[dc - 1]) {
    throw new RangeError('Unknown Telegram data center');
  }
  return addresses[dc - 1];
}
