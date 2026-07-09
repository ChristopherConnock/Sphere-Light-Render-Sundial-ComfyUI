# Server side of the input-driven render round-trip. The heavy ComfyUI wiring
# (route, send_sync, event wait) is added in later tasks; these two helpers are
# pure and import nothing.

def is_driven(prompt, node_id, param_names):
    """True if any of param_names is a connected input (a [upstream_id, slot]
    link) for this node in the prompt graph, rather than a literal widget value."""
    try:
        inputs = prompt[str(node_id)]["inputs"]
    except (KeyError, TypeError):
        return False
    return any(isinstance(inputs.get(name), list) for name in param_names)


def build_payload(node_id, run_token, params):
    return {"node_id": str(node_id), "run_token": run_token, "params": params}
