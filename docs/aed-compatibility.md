# AED compatibility review

The configurator and server share the fail-closed rules in `aed-catalog.js`. A rule is not enough to expose an accessory: the catalog record must also have an explicitly reviewed binding to its manufacturer part number and exact product identity. There are currently no approved accessory bindings. The two existing supplier preview accessory names did not expose exact manufacturer part numbers on the accessible supplier pages, so they cannot yet be selected. Changing a bound product name also invalidates its binding.

Manufacturer-documented relationships recorded for review:

| AED model | Manufacturer part | Manufacturer evidence |
| --- | --- | --- |
| ZOLL AED 3 | 8000-000696 battery | https://www.zoll.com/en-gb/products/accessories/by-product/aed-3 |
| ZOLL AED Plus | 8900-0800-01 CPR-D-padz | https://www.zoll.com/en-gb/products/accessories/by-product/aed-plus |
| Defibtech DDU-100 Lifeline AED | DDP-100 adult pads | https://www.defibtech.com/products/lifeline-aed/ |
| Defibtech DDU-2300 Lifeline VIEW | DDP-2001 adult pads | https://www.defibtech.com/products/lifeline-view-aed/ |

Before adding a binding, verify the exact supplier product and variant against its manufacturer part number, obtain a dated source, and review the device variant and any restrictions. Do not infer compatibility from a manufacturer name or a generic description. There are no universal-accessory bindings. Compatibility data is code-reviewed configuration, not yet an admin-managed database workflow.

The structured AED quote is validated on the server using catalog product IDs and quantities, not client-supplied descriptions or prices. General free-text inquiries remain available, but should never be treated as validated equipment configurations.
