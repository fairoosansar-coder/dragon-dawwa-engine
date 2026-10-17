# Railway volume sizing decision — 17 October 2026 UTC

The approved staging plan targeted approximately **5 GB aggregate persistent storage** across two MySQL volumes and one HumHub volume. The current Railway Pro plan instead creates each new volume with **50 GB capacity**. Three volumes would allocate **150 GB**. No volume was created while inspecting the form.

Railway documents that Pro volumes default to 50 GB, downsizing is unsupported, and billing is based on **used storage**, not allocated capacity. It also states that filesystem metadata consumes approximately 2–3% of the allocated volume, so an empty volume has billable used space. Across three default volumes, that implies approximately 3–4.5 GB of initial metadata before MySQL and HumHub data, not a guarantee that usage stays within 5 GB. [1]

A Railway employee confirms that custom initial volume sizes cannot currently be selected and that storage usage limits would need application/container enforcement. [2] The inspected creation UI only offered a mount path, not a smaller initial capacity.

**Decision required:** authorize the platform's three default 50 GB allocations with actual-used storage billing and no hard 5 GB cap, or retain the original capacity requirement and choose a different isolated hosting/storage arrangement. Do not silently create 150 GB of allocated capacity, change production-wide spending limits, or consolidate the separately approved databases to fit fewer volumes.

Source, protected variable and image preparation can continue without activating volumes or workloads. The Google staging project/client and designated author/different human reviewer/excluded account remain separate identity choices.

## References

[1]: https://docs.railway.com/volumes/reference "Official Railway volume defaults, usage billing, metadata overhead and downsizing restrictions"
[2]: https://station.railway.com/questions/creating-small-volume-562ce3b2 "Railway employee response: custom initial volume size is unavailable"
