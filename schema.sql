--
-- PostgreSQL database dump
--

\restrict ZrpzzJqBvMqZGamclv94ACAiqt0SPXERfSGLzszPxzXpLbGQ1rZUV5JKmKXUkNm

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_status AS ENUM (
    'active',
    'suspended',
    'banned'
);


--
-- Name: admin_action_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admin_action_type AS ENUM (
    'suspend_user',
    'ban_user',
    'remove_product'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'user',
    'admin'
);


--
-- Name: chat_context_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_context_type AS ENUM (
    'product',
    'rental',
    'food',
    'notes'
);


--
-- Name: chat_report_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_report_reason AS ENUM (
    'spam',
    'abuse',
    'harassment',
    'scam',
    'fake_listing',
    'inappropriate',
    'other'
);


--
-- Name: chat_report_target; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_report_target AS ENUM (
    'user',
    'conversation',
    'listing'
);


--
-- Name: conversation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conversation_status AS ENUM (
    'active',
    'archived',
    'reported',
    'completed',
    'auto_archived',
    'completion_pending'
);


--
-- Name: food_listing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.food_listing_status AS ENUM (
    'available',
    'hidden',
    'expired',
    'sold'
);


--
-- Name: food_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.food_order_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'completed',
    'cancelled'
);


--
-- Name: food_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.food_request_status AS ENUM (
    'open',
    'fulfilled',
    'expired',
    'closed'
);


--
-- Name: message_delivery_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_delivery_status AS ENUM (
    'sent',
    'delivered',
    'read'
);


--
-- Name: message_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_type AS ENUM (
    'text',
    'image'
);


--
-- Name: notes_listing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notes_listing_type AS ENUM (
    'sell',
    'rent'
);


--
-- Name: notes_purchase_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notes_purchase_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'completed',
    'cancelled',
    'returned',
    'active_rental',
    'return_requested'
);


--
-- Name: notes_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notes_request_status AS ENUM (
    'open',
    'fulfilled',
    'expired',
    'closed'
);


--
-- Name: notes_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notes_status AS ENUM (
    'available',
    'rented_out',
    'unavailable',
    'hidden'
);


--
-- Name: notification_module; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_module AS ENUM (
    'marketplace',
    'rentals',
    'notes',
    'food',
    'chats',
    'requests',
    'system'
);


--
-- Name: notification_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_priority AS ENUM (
    'critical',
    'important',
    'informational'
);


--
-- Name: product_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_request_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'completed',
    'cancelled'
);


--
-- Name: product_request_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_request_type AS ENUM (
    'buy',
    'offer'
);


--
-- Name: product_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_status AS ENUM (
    'available',
    'sold',
    'hidden'
);


--
-- Name: rental_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rental_request_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'returned',
    'completed',
    'cancelled',
    'active_rental',
    'return_requested'
);


--
-- Name: rental_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rental_status AS ENUM (
    'available',
    'rented_out',
    'unavailable'
);


--
-- Name: report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_status AS ENUM (
    'pending',
    'resolved',
    'dismissed'
);


--
-- Name: report_target_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_target_type AS ENUM (
    'product',
    'seller',
    'rental',
    'food',
    'notes'
);


--
-- Name: admin_access_conversation(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_access_conversation(p_conversation_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_reported boolean;
  v_has_pending_report boolean;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admin access required';
  end if;

  select is_reported into v_is_reported
  from public.conversations where id = p_conversation_id;

  select exists (
    select 1 from public.chat_reports
    where conversation_id = p_conversation_id and status = 'pending'
  ) into v_has_pending_report;

  if not coalesce(v_is_reported, false) and not v_has_pending_report then
    raise exception 'Admin access only allowed for reported conversations';
  end if;

  insert into public.chat_admin_access_logs (conversation_id, admin_id, reason)
  values (p_conversation_id, auth.uid(), p_reason);
end;
$$;


--
-- Name: assign_seller_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_seller_slug() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.generate_seller_slug(new.display_name);
  end if;
  return new;
end;
$$;


--
-- Name: can_admin_read_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_admin_read_conversation(p_conversation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.has_role(auth.uid(), 'admin')
    and exists (
      select 1 from public.conversations c
      where c.id = p_conversation_id
        and (c.is_reported = true or exists (
          select 1 from public.chat_reports cr
          where cr.conversation_id = c.id and cr.status = 'pending'
        ))
    );
$$;


--
-- Name: cleanup_orphaned_wishlist_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_orphaned_wishlist_items() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM wishlist_items
  WHERE listing_id NOT IN (
    SELECT id FROM product_listings
    UNION
    SELECT id FROM rental_listings
    UNION
    SELECT id FROM food_listings
    UNION
    SELECT id FROM notes_listings
  );
END;
$$;


--
-- Name: decline_conversation_completion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decline_conversation_completion(p_conversation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE conversations
  SET
    status = 'active',
    completion_requested_by = NULL,
    completion_requested_at = NULL,
    updated_at = now()
  WHERE id = p_conversation_id
    AND status = 'completion_pending'
    AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    AND completion_requested_by != auth.uid(); -- only the non-requester can decline
END;
$$;


--
-- Name: delete_wishlist_on_listing_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_wishlist_on_listing_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM wishlist_items WHERE listing_id = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: generate_seller_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_seller_slug(_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := regexp_replace(lower(coalesce(nullif(trim(_name), ''), 'seller')), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if base = '' then base := 'seller'; end if;
  candidate := base;
  while exists (select 1 from public.seller_profiles where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n::text;
  end loop;
  return candidate;
end;
$$;


--
-- Name: get_or_create_conversation(uuid, uuid, public.chat_context_type, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_conversation(p_buyer_id uuid, p_seller_id uuid, p_context_type public.chat_context_type, p_context_id uuid, p_request_id uuid, p_listing_title text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_buyer_id = p_seller_id then
    raise exception 'Cannot create conversation with yourself';
  end if;

  if auth.uid() is null or auth.uid() not in (p_buyer_id, p_seller_id) then
    raise exception 'Not authorized to create this conversation';
  end if;

  if public.is_user_currently_banned(auth.uid()) then
    raise exception 'Your account is banned.';
  end if;

  select id into v_id
  from public.conversations
  where buyer_id = p_buyer_id
    and context_type = p_context_type
    and context_id = p_context_id;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversations (
    buyer_id, seller_id, context_type, context_id, request_id, listing_title
  ) values (
    p_buyer_id, p_seller_id, p_context_type, p_context_id, p_request_id, p_listing_title
  )
  returning id into v_id;

  return v_id;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.email is null or lower(new.email) not like '%@vitstudent.ac.in' then
    raise exception 'Only VIT student emails (@vitstudent.ac.in) are allowed';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'user');

  return new;
end;
$$;


--
-- Name: handle_product_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_product_completion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE product_listings
    SET status = 'sold'
    WHERE id = NEW.product_id
      AND status = 'available';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;


--
-- Name: increment_listing_view(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_listing_view(p_item_type text, p_item_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  case p_item_type
    when 'product' then
      update public.product_listings set views_count = views_count + 1 where id = p_item_id;
    when 'rental' then
      update public.rental_listings set views_count = views_count + 1 where id = p_item_id;
    when 'food' then
      update public.food_listings set views_count = views_count + 1 where id = p_item_id;
    when 'notes' then
      update public.notes_listings set views_count = views_count + 1 where id = p_item_id;
    else
      raise exception 'Unknown item type: %', p_item_type;
  end case;
end;
$$;


--
-- Name: is_conversation_participant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_conversation_participant(p_conversation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and auth.uid() in (c.buyer_id, c.seller_id)
  );
$$;


--
-- Name: is_user_currently_banned(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_user_currently_banned(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and (p.status = 'banned' or p.banned_at is not null)
      and (p.banned_until is null or p.banned_until > now())
  );
$$;


--
-- Name: mark_conversation_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_conversation_read(p_conversation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
begin
  select buyer_id, seller_id into v_buyer_id, v_seller_id
  from public.conversations where id = p_conversation_id;

  if auth.uid() is null or auth.uid() not in (v_buyer_id, v_seller_id) then
    raise exception 'Not authorized';
  end if;

  update public.messages
  set delivery_status = 'read', read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> auth.uid()
    and delivery_status <> 'read';

  if auth.uid() = v_buyer_id then
    update public.conversations set buyer_unread_count = 0 where id = p_conversation_id;
  else
    update public.conversations set seller_unread_count = 0 where id = p_conversation_id;
  end if;
end;
$$;


--
-- Name: on_conversation_rating_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_conversation_rating_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_seller_id uuid;
  v_new_avg numeric;
  v_new_count integer;
begin
  select seller_id into v_seller_id
  from public.conversations where id = new.conversation_id;

  select
    round(avg(cr.rating)::numeric, 2),
    count(*)::integer
  into v_new_avg, v_new_count
  from public.conversation_ratings cr
  join public.conversations c on c.id = cr.conversation_id
  where c.seller_id = v_seller_id;

  update public.seller_profiles
  set
    rating_avg = coalesce(v_new_avg, 0),
    rating_count = coalesce(v_new_count, 0),
    total_sold = total_sold + 1
  where user_id = v_seller_id;

  return new;
end;
$$;


--
-- Name: on_message_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_message_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_preview text;
begin
  select buyer_id, seller_id into v_buyer_id, v_seller_id
  from public.conversations where id = new.conversation_id;

  if new.message_type = 'image' then
    v_preview := '📷 Image';
  else
    v_preview := left(new.content, 120);
  end if;

  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_preview = v_preview,
    last_message_sender_id = new.sender_id,
    buyer_unread_count = case
      when new.sender_id = v_seller_id then buyer_unread_count + 1
      else buyer_unread_count
    end,
    seller_unread_count = case
      when new.sender_id = v_buyer_id then seller_unread_count + 1
      else seller_unread_count
    end,
    updated_at = now()
  where id = new.conversation_id;

  -- Mark as delivered immediately for recipient visibility
  new.delivery_status := 'delivered';

  return new;
end;
$$;


--
-- Name: request_conversation_completion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_conversation_completion(p_conversation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE conversations
  SET
    status = 'completion_pending',
    completion_requested_by = auth.uid(),
    completion_requested_at = now(),
    updated_at = now()
  WHERE id = p_conversation_id
    AND status = 'active'
    AND (buyer_id = auth.uid() OR seller_id = auth.uid());
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_listing_wishlist_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_listing_wishlist_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN

  -- Ignore new wishlist rows that don't use item_type
  IF TG_OP = 'INSERT' THEN

    IF NEW.item_type IS NULL THEN
      RETURN NEW;
    END IF;

    CASE NEW.item_type
      WHEN 'product' THEN
        UPDATE product_listings
        SET wishlist_count = wishlist_count + 1
        WHERE id = NEW.item_id;

      WHEN 'rental' THEN
        UPDATE rental_listings
        SET wishlist_count = wishlist_count + 1
        WHERE id = NEW.item_id;

      WHEN 'food' THEN
        UPDATE food_listings
        SET wishlist_count = wishlist_count + 1
        WHERE id = NEW.item_id;

      WHEN 'notes' THEN
        UPDATE notes_listings
        SET wishlist_count = wishlist_count + 1
        WHERE id = NEW.item_id;

      ELSE
        RETURN NEW;
    END CASE;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN

    IF OLD.item_type IS NULL THEN
      RETURN OLD;
    END IF;

    CASE OLD.item_type
      WHEN 'product' THEN
        UPDATE product_listings
        SET wishlist_count = GREATEST(0, wishlist_count - 1)
        WHERE id = OLD.item_id;

      WHEN 'rental' THEN
        UPDATE rental_listings
        SET wishlist_count = GREATEST(0, wishlist_count - 1)
        WHERE id = OLD.item_id;

      WHEN 'food' THEN
        UPDATE food_listings
        SET wishlist_count = GREATEST(0, wishlist_count - 1)
        WHERE id = OLD.item_id;

      WHEN 'notes' THEN
        UPDATE notes_listings
        SET wishlist_count = GREATEST(0, wishlist_count - 1)
        WHERE id = OLD.item_id;

      ELSE
        RETURN OLD;
    END CASE;

    RETURN OLD;

  END IF;

  RETURN NULL;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    action_type public.admin_action_type NOT NULL,
    target_user_id uuid,
    product_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_admin_access_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_admin_access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    admin_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    report_target public.chat_report_target NOT NULL,
    reported_user_id uuid,
    reason public.chat_report_reason NOT NULL,
    details text,
    status public.report_status DEFAULT 'pending'::public.report_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    rater_id uuid NOT NULL,
    rating smallint NOT NULL,
    review text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    context_type public.chat_context_type NOT NULL,
    context_id uuid NOT NULL,
    request_id uuid,
    listing_title text NOT NULL,
    status public.conversation_status DEFAULT 'active'::public.conversation_status NOT NULL,
    is_reported boolean DEFAULT false NOT NULL,
    last_message_at timestamp with time zone,
    last_message_preview text,
    last_message_sender_id uuid,
    buyer_unread_count integer DEFAULT 0 NOT NULL,
    seller_unread_count integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archive_reason text,
    completion_requested_by uuid,
    completion_requested_at timestamp with time zone,
    CONSTRAINT conversations_buyer_seller_distinct CHECK ((buyer_id <> seller_id))
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    rating integer NOT NULL,
    category text NOT NULL,
    message text NOT NULL,
    screenshot_url text,
    status text DEFAULT 'submitted'::text NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: food_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    food_listing_id uuid NOT NULL,
    storage_path text NOT NULL,
    sort_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT food_images_sort_index_check CHECK (((sort_index >= 0) AND (sort_index <= 4)))
);


--
-- Name: food_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    product_name text NOT NULL,
    brand_name text NOT NULL,
    category text NOT NULL,
    quantity text NOT NULL,
    price numeric(12,2) NOT NULL,
    description text NOT NULL,
    expiry_date date NOT NULL,
    status public.food_listing_status DEFAULT 'available'::public.food_listing_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    views_count integer DEFAULT 0 NOT NULL,
    wishlist_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT food_listings_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: food_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    food_listing_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    message text,
    status public.food_order_status DEFAULT 'pending'::public.food_order_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT food_orders_quantity_check CHECK ((quantity >= 1))
);


--
-- Name: food_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    product_name text NOT NULL,
    category text NOT NULL,
    quantity_needed text NOT NULL,
    description text NOT NULL,
    urgency_level text DEFAULT 'normal'::text NOT NULL,
    status public.food_request_status DEFAULT 'open'::public.food_request_status NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message_type public.message_type DEFAULT 'text'::public.message_type NOT NULL,
    content text NOT NULL,
    delivery_status public.message_delivery_status DEFAULT 'sent'::public.message_delivery_status NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notes_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    kind text NOT NULL,
    storage_path text NOT NULL,
    sort_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes_listing_id uuid,
    CONSTRAINT notes_assets_kind_check CHECK ((kind = ANY (ARRAY['pdf'::text, 'image'::text])))
);


--
-- Name: notes_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    listing_type public.notes_listing_type NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    subject text,
    faculty text,
    semester text,
    branch text,
    daily_rental_price numeric(12,2),
    rental_duration_days integer,
    condition text,
    is_digital boolean DEFAULT true NOT NULL,
    is_free boolean DEFAULT false NOT NULL,
    status public.notes_status DEFAULT 'available'::public.notes_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    views_count integer DEFAULT 0 NOT NULL,
    wishlist_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT notes_listings_condition_check CHECK ((condition = ANY (ARRAY['New'::text, 'Like New'::text, 'Good'::text, 'Fair'::text, 'Used'::text]))),
    CONSTRAINT notes_listings_daily_rental_price_check CHECK ((daily_rental_price >= (0)::numeric)),
    CONSTRAINT notes_listings_rental_duration_days_check CHECK ((rental_duration_days >= 1))
);


--
-- Name: notes_purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes_purchase_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notes_listing_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    message text,
    status public.notes_purchase_status DEFAULT 'pending'::public.notes_purchase_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notes_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    subject text NOT NULL,
    request_type text NOT NULL,
    description text NOT NULL,
    urgency_level text DEFAULT 'normal'::text NOT NULL,
    semester text,
    branch text,
    status public.notes_request_status DEFAULT 'open'::public.notes_request_status NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    user_id uuid NOT NULL,
    marketplace boolean DEFAULT true NOT NULL,
    rentals boolean DEFAULT true NOT NULL,
    notes boolean DEFAULT true NOT NULL,
    food boolean DEFAULT true NOT NULL,
    chats boolean DEFAULT true NOT NULL,
    requests boolean DEFAULT true NOT NULL,
    system boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    sound_enabled boolean DEFAULT true NOT NULL,
    desktop_enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    priority public.notification_priority DEFAULT 'informational'::public.notification_priority NOT NULL,
    module public.notification_module NOT NULL,
    read boolean DEFAULT false NOT NULL,
    action_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    storage_path text NOT NULL,
    sort_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_images_sort_index_check CHECK (((sort_index >= 0) AND (sort_index <= 4)))
);


--
-- Name: product_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    custom_category text,
    price numeric(12,2) NOT NULL,
    condition text NOT NULL,
    urgent_sale boolean DEFAULT false NOT NULL,
    status public.product_status DEFAULT 'available'::public.product_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_negotiable boolean DEFAULT false,
    location text,
    wishlist_count integer DEFAULT 0,
    views_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT product_listings_condition_check CHECK ((condition = ANY (ARRAY['New'::text, 'Like New'::text, 'Good'::text, 'Fair'::text, 'Used'::text]))),
    CONSTRAINT product_listings_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: product_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    request_type public.product_request_type DEFAULT 'buy'::public.product_request_type NOT NULL,
    offered_price numeric(12,2),
    message text,
    status public.product_request_status DEFAULT 'pending'::public.product_request_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_requests_offered_price_check CHECK (((offered_price IS NULL) OR (offered_price >= (0)::numeric)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    hostel_block text,
    avatar_url text,
    is_profile_complete boolean DEFAULT false NOT NULL,
    status public.account_status DEFAULT 'active'::public.account_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hostel_type text,
    room_number text,
    phone_number text,
    banned_at timestamp with time zone,
    banned_until timestamp with time zone,
    ban_reason text,
    banned_by uuid
);


--
-- Name: rental_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rental_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rental_id uuid NOT NULL,
    storage_path text NOT NULL,
    sort_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rental_images_sort_index_check CHECK (((sort_index >= 0) AND (sort_index <= 4)))
);


--
-- Name: rental_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rental_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    custom_category text,
    rent_price_per_day numeric(12,2) NOT NULL,
    condition text NOT NULL,
    status public.rental_status DEFAULT 'available'::public.rental_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    views_count integer DEFAULT 0 NOT NULL,
    wishlist_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT rental_listings_condition_check CHECK ((condition = ANY (ARRAY['New'::text, 'Like New'::text, 'Good'::text, 'Fair'::text, 'Used'::text]))),
    CONSTRAINT rental_listings_rent_price_per_day_check CHECK ((rent_price_per_day >= (0)::numeric))
);


--
-- Name: rental_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rental_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rental_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    status public.rental_request_status DEFAULT 'pending'::public.rental_request_status NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    target_type public.report_target_type NOT NULL,
    product_id uuid,
    seller_user_id uuid,
    reason text NOT NULL,
    details text,
    status public.report_status DEFAULT 'pending'::public.report_status NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rental_id uuid,
    food_listing_id uuid,
    notes_listing_id uuid,
    evidence_urls text[],
    evidence_count integer DEFAULT 0,
    CONSTRAINT reports_check CHECK ((((target_type = 'product'::public.report_target_type) AND (product_id IS NOT NULL) AND (rental_id IS NULL) AND (food_listing_id IS NULL) AND (notes_listing_id IS NULL)) OR ((target_type = 'seller'::public.report_target_type) AND (seller_user_id IS NOT NULL) AND (product_id IS NULL) AND (rental_id IS NULL) AND (food_listing_id IS NULL) AND (notes_listing_id IS NULL)) OR ((target_type = 'rental'::public.report_target_type) AND (rental_id IS NOT NULL) AND (product_id IS NULL) AND (food_listing_id IS NULL) AND (notes_listing_id IS NULL)) OR ((target_type = 'food'::public.report_target_type) AND (food_listing_id IS NOT NULL) AND (product_id IS NULL) AND (rental_id IS NULL) AND (notes_listing_id IS NULL)) OR ((target_type = 'notes'::public.report_target_type) AND (notes_listing_id IS NOT NULL) AND (product_id IS NULL) AND (rental_id IS NULL) AND (food_listing_id IS NULL))))
);


--
-- Name: seller_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    bio text,
    avatar_url text,
    rating_avg numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    total_sold integer DEFAULT 0 NOT NULL,
    total_rented_out integer DEFAULT 0 NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seller_rating_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.seller_rating_summary AS
 SELECT c.seller_id,
    round(avg(cr.rating), 2) AS average_rating,
    count(*) AS total_reviews
   FROM (public.conversation_ratings cr
     JOIN public.conversations c ON ((c.id = cr.conversation_id)))
  GROUP BY c.seller_id;


--
-- Name: VIEW seller_rating_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.seller_rating_summary IS 'Aggregated rating stats per seller (average_rating, total_reviews), for display on seller profiles.';


--
-- Name: seller_reviews_feed; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.seller_reviews_feed AS
 SELECT cr.id AS review_id,
    cr.conversation_id,
    c.seller_id,
    cr.rater_id AS reviewer_id,
    p.full_name AS reviewer_name,
    p.avatar_url AS reviewer_avatar_url,
    c.listing_title,
    c.context_type AS listing_type,
    cr.rating,
    cr.review,
    cr.created_at
   FROM ((public.conversation_ratings cr
     JOIN public.conversations c ON ((c.id = cr.conversation_id)))
     LEFT JOIN public.profiles p ON ((p.id = cr.rater_id)));


--
-- Name: VIEW seller_reviews_feed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.seller_reviews_feed IS 'Per-review feed with reviewer display info, joined for direct use on seller profile pages. Verify profiles.full_name / profiles.avatar_url match your actual profiles column names.';


--
-- Name: suspicious_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suspicious_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    flag_type text NOT NULL,
    score integer DEFAULT 1 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_presence (
    user_id uuid NOT NULL,
    is_online boolean DEFAULT false NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    typing_conversation_id uuid,
    typing_updated_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    item_type text,
    item_id uuid
);


--
-- Name: admin_actions admin_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);


--
-- Name: chat_admin_access_logs chat_admin_access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_admin_access_logs
    ADD CONSTRAINT chat_admin_access_logs_pkey PRIMARY KEY (id);


--
-- Name: chat_reports chat_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_pkey PRIMARY KEY (id);


--
-- Name: conversation_ratings conversation_ratings_conversation_id_rater_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_ratings
    ADD CONSTRAINT conversation_ratings_conversation_id_rater_id_key UNIQUE (conversation_id, rater_id);


--
-- Name: conversation_ratings conversation_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_ratings
    ADD CONSTRAINT conversation_ratings_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_unique_listing_buyer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_unique_listing_buyer UNIQUE (buyer_id, context_type, context_id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: food_images food_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_images
    ADD CONSTRAINT food_images_pkey PRIMARY KEY (id);


--
-- Name: food_listings food_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_listings
    ADD CONSTRAINT food_listings_pkey PRIMARY KEY (id);


--
-- Name: food_orders food_orders_food_listing_id_buyer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_food_listing_id_buyer_id_key UNIQUE (food_listing_id, buyer_id);


--
-- Name: food_orders food_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_pkey PRIMARY KEY (id);


--
-- Name: food_requests food_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_requests
    ADD CONSTRAINT food_requests_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notes_assets notes_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_assets
    ADD CONSTRAINT notes_assets_pkey PRIMARY KEY (id);


--
-- Name: notes_listings notes_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_listings
    ADD CONSTRAINT notes_listings_pkey PRIMARY KEY (id);


--
-- Name: notes_purchase_requests notes_purchase_requests_notes_listing_id_buyer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_purchase_requests
    ADD CONSTRAINT notes_purchase_requests_notes_listing_id_buyer_id_key UNIQUE (notes_listing_id, buyer_id);


--
-- Name: notes_purchase_requests notes_purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_purchase_requests
    ADD CONSTRAINT notes_purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: notes_requests notes_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_requests
    ADD CONSTRAINT notes_requests_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_listings product_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_listings
    ADD CONSTRAINT product_listings_pkey PRIMARY KEY (id);


--
-- Name: product_requests product_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_requests
    ADD CONSTRAINT product_requests_pkey PRIMARY KEY (id);


--
-- Name: product_requests product_requests_product_id_buyer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_requests
    ADD CONSTRAINT product_requests_product_id_buyer_id_key UNIQUE (product_id, buyer_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rental_images rental_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_images
    ADD CONSTRAINT rental_images_pkey PRIMARY KEY (id);


--
-- Name: rental_listings rental_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_listings
    ADD CONSTRAINT rental_listings_pkey PRIMARY KEY (id);


--
-- Name: rental_requests rental_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_requests
    ADD CONSTRAINT rental_requests_pkey PRIMARY KEY (id);


--
-- Name: rental_requests rental_requests_rental_id_buyer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_requests
    ADD CONSTRAINT rental_requests_rental_id_buyer_id_key UNIQUE (rental_id, buyer_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: seller_profiles seller_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_profiles
    ADD CONSTRAINT seller_profiles_pkey PRIMARY KEY (id);


--
-- Name: seller_profiles seller_profiles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_profiles
    ADD CONSTRAINT seller_profiles_slug_key UNIQUE (slug);


--
-- Name: seller_profiles seller_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_profiles
    ADD CONSTRAINT seller_profiles_user_id_key UNIQUE (user_id);


--
-- Name: suspicious_flags suspicious_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suspicious_flags
    ADD CONSTRAINT suspicious_flags_pkey PRIMARY KEY (id);


--
-- Name: user_presence user_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_pkey PRIMARY KEY (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_user_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_listing_id_key UNIQUE (user_id, listing_id);


--
-- Name: chat_reports_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_reports_conversation_idx ON public.chat_reports USING btree (conversation_id, created_at DESC);


--
-- Name: chat_reports_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_reports_pending_idx ON public.chat_reports USING btree (status, created_at DESC) WHERE (status = 'pending'::public.report_status);


--
-- Name: conversations_participants_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_participants_idx ON public.conversations USING btree (buyer_id, seller_id, last_message_at DESC NULLS LAST);


--
-- Name: conversations_seller_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_seller_idx ON public.conversations USING btree (seller_id, last_message_at DESC NULLS LAST);


--
-- Name: conversations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_status_idx ON public.conversations USING btree (status, last_message_at DESC NULLS LAST);


--
-- Name: food_images_listing_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX food_images_listing_sort_idx ON public.food_images USING btree (food_listing_id, sort_index);


--
-- Name: food_listings_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX food_listings_status_created_at_idx ON public.food_listings USING btree (status, created_at DESC);


--
-- Name: food_requests_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX food_requests_status_created_at_idx ON public.food_requests USING btree (status, created_at DESC);


--
-- Name: messages_conversation_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_created_idx ON public.messages USING btree (conversation_id, created_at);


--
-- Name: notes_assets_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notes_assets_listing_idx ON public.notes_assets USING btree (listing_id, sort_index);


--
-- Name: notes_listings_type_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notes_listings_type_status_created_at_idx ON public.notes_listings USING btree (listing_type, status, created_at DESC);


--
-- Name: notes_requests_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notes_requests_status_created_at_idx ON public.notes_requests USING btree (status, created_at DESC);


--
-- Name: notifications_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: notifications_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, read) WHERE (read = false);


--
-- Name: product_images_product_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_images_product_sort_idx ON public.product_images USING btree (product_id, sort_index);


--
-- Name: product_listings_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_listings_status_created_at_idx ON public.product_listings USING btree (status, created_at DESC);


--
-- Name: product_requests_buyer_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_requests_buyer_status_idx ON public.product_requests USING btree (buyer_id, status, created_at DESC);


--
-- Name: product_requests_seller_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_requests_seller_status_idx ON public.product_requests USING btree (seller_id, status, created_at DESC);


--
-- Name: profiles_banned_until_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_banned_until_idx ON public.profiles USING btree (banned_until) WHERE (banned_until IS NOT NULL);


--
-- Name: profiles_permanent_ban_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_permanent_ban_idx ON public.profiles USING btree (banned_at) WHERE ((banned_until IS NULL) AND (banned_at IS NOT NULL));


--
-- Name: rental_images_rental_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rental_images_rental_sort_idx ON public.rental_images USING btree (rental_id, sort_index);


--
-- Name: rental_listings_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rental_listings_status_created_at_idx ON public.rental_listings USING btree (status, created_at DESC);


--
-- Name: reports_seller_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_seller_user_id_idx ON public.reports USING btree (seller_user_id) WHERE (seller_user_id IS NOT NULL);


--
-- Name: reports_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_status_created_at_idx ON public.reports USING btree (status, created_at DESC);


--
-- Name: reports_status_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_status_target_idx ON public.reports USING btree (status, target_type, created_at DESC);


--
-- Name: suspicious_flags_resolved_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suspicious_flags_resolved_created_at_idx ON public.suspicious_flags USING btree (resolved, created_at DESC);


--
-- Name: conversation_ratings conversation_ratings_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversation_ratings_after_insert AFTER INSERT ON public.conversation_ratings FOR EACH ROW EXECUTE FUNCTION public.on_conversation_rating_insert();


--
-- Name: conversations conversations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: food_listings food_listings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER food_listings_set_updated_at BEFORE UPDATE ON public.food_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: food_orders food_orders_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER food_orders_set_updated_at BEFORE UPDATE ON public.food_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: food_requests food_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER food_requests_set_updated_at BEFORE UPDATE ON public.food_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: messages messages_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_before_insert BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.on_message_insert();


--
-- Name: notes_listings notes_listings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notes_listings_set_updated_at BEFORE UPDATE ON public.notes_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: notes_purchase_requests notes_purchase_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notes_purchase_requests_set_updated_at BEFORE UPDATE ON public.notes_purchase_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: notes_requests notes_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notes_requests_set_updated_at BEFORE UPDATE ON public.notes_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: notification_preferences notification_preferences_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notification_preferences_set_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_requests on_product_transaction_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_product_transaction_complete AFTER UPDATE ON public.product_requests FOR EACH ROW EXECUTE FUNCTION public.handle_product_completion();


--
-- Name: product_listings product_listings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_listings_set_updated_at BEFORE UPDATE ON public.product_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_requests product_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_requests_set_updated_at BEFORE UPDATE ON public.product_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rental_listings rental_listings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rental_listings_set_updated_at BEFORE UPDATE ON public.rental_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rental_requests rental_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rental_requests_set_updated_at BEFORE UPDATE ON public.rental_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reports reports_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: seller_profiles seller_profiles_assign_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER seller_profiles_assign_slug BEFORE INSERT ON public.seller_profiles FOR EACH ROW EXECUTE FUNCTION public.assign_seller_slug();


--
-- Name: seller_profiles seller_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER seller_profiles_set_updated_at BEFORE UPDATE ON public.seller_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: suspicious_flags suspicious_flags_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER suspicious_flags_set_updated_at BEFORE UPDATE ON public.suspicious_flags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: food_listings trg_wishlist_cleanup_food; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wishlist_cleanup_food AFTER DELETE ON public.food_listings FOR EACH ROW EXECUTE FUNCTION public.delete_wishlist_on_listing_delete();


--
-- Name: notes_listings trg_wishlist_cleanup_notes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wishlist_cleanup_notes AFTER DELETE ON public.notes_listings FOR EACH ROW EXECUTE FUNCTION public.delete_wishlist_on_listing_delete();


--
-- Name: product_listings trg_wishlist_cleanup_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wishlist_cleanup_product AFTER DELETE ON public.product_listings FOR EACH ROW EXECUTE FUNCTION public.delete_wishlist_on_listing_delete();


--
-- Name: rental_listings trg_wishlist_cleanup_rental; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wishlist_cleanup_rental AFTER DELETE ON public.rental_listings FOR EACH ROW EXECUTE FUNCTION public.delete_wishlist_on_listing_delete();


--
-- Name: user_presence user_presence_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_presence_set_updated_at BEFORE UPDATE ON public.user_presence FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: wishlist_items wishlist_items_sync_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wishlist_items_sync_count AFTER INSERT OR DELETE ON public.wishlist_items FOR EACH ROW EXECUTE FUNCTION public.sync_listing_wishlist_count();


--
-- Name: admin_actions admin_actions_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_actions admin_actions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product_listings(id) ON DELETE SET NULL;


--
-- Name: admin_actions admin_actions_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_admin_access_logs chat_admin_access_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_admin_access_logs
    ADD CONSTRAINT chat_admin_access_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_admin_access_logs chat_admin_access_logs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_admin_access_logs
    ADD CONSTRAINT chat_admin_access_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_reports chat_reports_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_reports chat_reports_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_reports chat_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversation_ratings conversation_ratings_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_ratings
    ADD CONSTRAINT conversation_ratings_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_ratings conversation_ratings_rater_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_ratings
    ADD CONSTRAINT conversation_ratings_rater_id_fkey FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_last_message_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_last_message_sender_id_fkey FOREIGN KEY (last_message_sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: food_images food_images_food_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_images
    ADD CONSTRAINT food_images_food_listing_id_fkey FOREIGN KEY (food_listing_id) REFERENCES public.food_listings(id) ON DELETE CASCADE;


--
-- Name: food_listings food_listings_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_listings
    ADD CONSTRAINT food_listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.seller_profiles(user_id) ON DELETE CASCADE;


--
-- Name: food_orders food_orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: food_orders food_orders_food_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_food_listing_id_fkey FOREIGN KEY (food_listing_id) REFERENCES public.food_listings(id) ON DELETE CASCADE;


--
-- Name: food_orders food_orders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_orders
    ADD CONSTRAINT food_orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: food_requests food_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_requests
    ADD CONSTRAINT food_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notes_assets notes_assets_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_assets
    ADD CONSTRAINT notes_assets_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.notes_listings(id) ON DELETE CASCADE;


--
-- Name: notes_assets notes_assets_notes_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_assets
    ADD CONSTRAINT notes_assets_notes_listing_id_fkey FOREIGN KEY (notes_listing_id) REFERENCES public.notes_listings(id);


--
-- Name: notes_listings notes_listings_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_listings
    ADD CONSTRAINT notes_listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.seller_profiles(user_id) ON DELETE CASCADE;


--
-- Name: notes_purchase_requests notes_purchase_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_purchase_requests
    ADD CONSTRAINT notes_purchase_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notes_purchase_requests notes_purchase_requests_notes_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_purchase_requests
    ADD CONSTRAINT notes_purchase_requests_notes_listing_id_fkey FOREIGN KEY (notes_listing_id) REFERENCES public.notes_listings(id) ON DELETE CASCADE;


--
-- Name: notes_purchase_requests notes_purchase_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_purchase_requests
    ADD CONSTRAINT notes_purchase_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notes_requests notes_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes_requests
    ADD CONSTRAINT notes_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product_listings(id) ON DELETE CASCADE;


--
-- Name: product_listings product_listings_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_listings
    ADD CONSTRAINT product_listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.seller_profiles(user_id) ON DELETE CASCADE;


--
-- Name: product_requests product_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_requests
    ADD CONSTRAINT product_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: product_requests product_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_requests
    ADD CONSTRAINT product_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product_listings(id) ON DELETE CASCADE;


--
-- Name: product_requests product_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_requests
    ADD CONSTRAINT product_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_banned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rental_images rental_images_rental_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_images
    ADD CONSTRAINT rental_images_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rental_listings(id) ON DELETE CASCADE;


--
-- Name: rental_listings rental_listings_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_listings
    ADD CONSTRAINT rental_listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.seller_profiles(user_id) ON DELETE CASCADE;


--
-- Name: rental_requests rental_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_requests
    ADD CONSTRAINT rental_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rental_requests rental_requests_rental_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_requests
    ADD CONSTRAINT rental_requests_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rental_listings(id) ON DELETE CASCADE;


--
-- Name: rental_requests rental_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_requests
    ADD CONSTRAINT rental_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_food_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_food_listing_id_fkey FOREIGN KEY (food_listing_id) REFERENCES public.food_listings(id) ON DELETE CASCADE;


--
-- Name: reports reports_notes_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_notes_listing_id_fkey FOREIGN KEY (notes_listing_id) REFERENCES public.notes_listings(id) ON DELETE CASCADE;


--
-- Name: reports reports_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product_listings(id) ON DELETE CASCADE;


--
-- Name: reports reports_rental_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rental_listings(id) ON DELETE CASCADE;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: reports reports_seller_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_seller_user_id_fkey FOREIGN KEY (seller_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: seller_profiles seller_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_profiles
    ADD CONSTRAINT seller_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: suspicious_flags suspicious_flags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suspicious_flags
    ADD CONSTRAINT suspicious_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_presence user_presence_typing_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_typing_conversation_id_fkey FOREIGN KEY (typing_conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: user_presence user_presence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: product_listings Admins can delete all product listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete all product listings" ON public.product_listings FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: product_listings Admins can delete any product listing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any product listing" ON public.product_listings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: rental_listings Admins can delete any rental listing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any rental listing" ON public.rental_listings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: chat_admin_access_logs Admins can insert access logs via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert access logs via RPC" ON public.chat_admin_access_logs FOR INSERT TO authenticated WITH CHECK (((admin_id = auth.uid()) AND public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: admin_actions Admins can insert admin actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert admin actions" ON public.admin_actions FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (admin_user_id = auth.uid())));


--
-- Name: suspicious_flags Admins can manage suspicious flags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage suspicious flags" ON public.suspicious_flags TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_admin_access_logs Admins can read access logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read access logs" ON public.chat_admin_access_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: admin_actions Admins can read admin actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read admin actions" ON public.admin_actions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can read all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reports Admins can read all reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::public.app_role))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::public.app_role)))));


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_reports Admins can update chat reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update chat reports" ON public.chat_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reports Admins can update reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::public.app_role)))));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: food_requests Anyone authenticated can fulfill food requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone authenticated can fulfill food requests" ON public.food_requests FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: notes_requests Anyone authenticated can fulfill requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone authenticated can fulfill requests" ON public.notes_requests FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: feedback Anyone can submit feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit feedback" ON public.feedback FOR INSERT WITH CHECK (true);


--
-- Name: conversations Authenticated can insert conversations via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can insert conversations via RPC" ON public.conversations FOR INSERT TO authenticated WITH CHECK ((((auth.uid() = buyer_id) OR (auth.uid() = seller_id)) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notifications Authenticated can insert notifications for any user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can insert notifications for any user" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: user_presence Authenticated can read presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read presence" ON public.user_presence FOR SELECT TO authenticated USING (true);


--
-- Name: food_orders Buyer can create food orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer can create food orders" ON public.food_orders FOR INSERT TO authenticated WITH CHECK (((buyer_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notes_purchase_requests Buyer can create notes purchase requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer can create notes purchase requests" ON public.notes_purchase_requests FOR INSERT TO authenticated WITH CHECK (((buyer_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: product_requests Buyer can create product requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer can create product requests" ON public.product_requests FOR INSERT TO authenticated WITH CHECK (((buyer_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: rental_requests Buyer can create rental requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer can create rental requests" ON public.rental_requests FOR INSERT TO authenticated WITH CHECK (((buyer_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: food_orders Buyer or seller can read food orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer or seller can read food orders" ON public.food_orders FOR SELECT TO authenticated USING (((buyer_id = auth.uid()) OR (seller_id = auth.uid())));


--
-- Name: notes_purchase_requests Buyer or seller can read notes purchase requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer or seller can read notes purchase requests" ON public.notes_purchase_requests FOR SELECT TO authenticated USING (((buyer_id = auth.uid()) OR (seller_id = auth.uid())));


--
-- Name: product_requests Buyer or seller can read product requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer or seller can read product requests" ON public.product_requests FOR SELECT TO authenticated USING (((buyer_id = auth.uid()) OR (seller_id = auth.uid())));


--
-- Name: rental_requests Buyer or seller can read related rental requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer or seller can read related rental requests" ON public.rental_requests FOR SELECT TO authenticated USING (((buyer_id = auth.uid()) OR (seller_id = auth.uid())));


--
-- Name: food_orders Buyer or seller can update food orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer or seller can update food orders" ON public.food_orders FOR UPDATE TO authenticated USING ((((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK ((((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notes_purchase_requests Buyer or seller can update notes purchase requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer or seller can update notes purchase requests" ON public.notes_purchase_requests FOR UPDATE TO authenticated USING ((((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK ((((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: product_requests Buyer or seller can update product requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer or seller can update product requests" ON public.product_requests FOR UPDATE TO authenticated USING ((((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK ((((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: rental_requests Buyer or seller can update related rental requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyer or seller can update related rental requests" ON public.rental_requests FOR UPDATE TO authenticated USING ((((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK ((((buyer_id = auth.uid()) OR (seller_id = auth.uid())) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: conversation_ratings Buyers can rate sellers on completed deals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyers can rate sellers on completed deals" ON public.conversation_ratings FOR INSERT WITH CHECK (((rater_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid())) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_ratings.conversation_id) AND (c.status = 'completed'::public.conversation_status) AND (c.buyer_id = auth.uid()))))));


--
-- Name: notes_assets Guests can read assets for available notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read assets for available notes listings" ON public.notes_assets FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.notes_listings nl
  WHERE ((nl.id = notes_assets.listing_id) AND (nl.status = 'available'::public.notes_status)))));


--
-- Name: food_listings Guests can read available and non-expired food listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read available and non-expired food listings" ON public.food_listings FOR SELECT TO anon USING (((status = 'available'::public.food_listing_status) AND (expiry_date >= CURRENT_DATE)));


--
-- Name: notes_listings Guests can read available notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read available notes listings" ON public.notes_listings FOR SELECT TO anon USING ((status = 'available'::public.notes_status));


--
-- Name: product_listings Guests can read available product listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read available product listings" ON public.product_listings FOR SELECT TO anon USING ((status = 'available'::public.product_status));


--
-- Name: rental_listings Guests can read available rental listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read available rental listings" ON public.rental_listings FOR SELECT TO anon USING ((status = 'available'::public.rental_status));


--
-- Name: food_images Guests can read images for available and non-expired food listi; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read images for available and non-expired food listi" ON public.food_images FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.food_listings fl
  WHERE ((fl.id = food_images.food_listing_id) AND (fl.status = 'available'::public.food_listing_status) AND (fl.expiry_date >= CURRENT_DATE)))));


--
-- Name: product_images Guests can read images for available product listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read images for available product listings" ON public.product_images FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.product_listings pl
  WHERE ((pl.id = product_images.product_id) AND (pl.status = 'available'::public.product_status)))));


--
-- Name: rental_images Guests can read images for available rentals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read images for available rentals" ON public.rental_images FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.rental_listings rl
  WHERE ((rl.id = rental_images.rental_id) AND (rl.status = 'available'::public.rental_status)))));


--
-- Name: food_requests Guests can read open food requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read open food requests" ON public.food_requests FOR SELECT TO anon USING ((status = 'open'::public.food_request_status));


--
-- Name: notes_requests Guests can read open notes requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can read open notes requests" ON public.notes_requests FOR SELECT TO anon USING ((status = 'open'::public.notes_request_status));


--
-- Name: feedback Only admins can view feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can view feedback" ON public.feedback FOR SELECT USING ((auth.uid() IN ( SELECT user_roles.user_id
   FROM public.user_roles
  WHERE (user_roles.role = 'admin'::public.app_role))));


--
-- Name: notes_listings Owners can delete their notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete their notes listings" ON public.notes_listings FOR DELETE USING ((auth.uid() = seller_id));


--
-- Name: chat_reports Participants can file chat reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can file chat reports" ON public.chat_reports FOR INSERT TO authenticated WITH CHECK (((reporter_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid())) AND public.is_conversation_participant(conversation_id)));


--
-- Name: messages Participants can read messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can read messages" ON public.messages FOR SELECT TO authenticated USING ((public.is_conversation_participant(conversation_id) OR public.can_admin_read_conversation(conversation_id)));


--
-- Name: chat_reports Participants can read own chat reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can read own chat reports" ON public.chat_reports FOR SELECT TO authenticated USING (((reporter_id = auth.uid()) OR public.can_admin_read_conversation(conversation_id)));


--
-- Name: conversations Participants can read own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can read own conversations" ON public.conversations FOR SELECT TO authenticated USING ((((auth.uid() = buyer_id) OR (auth.uid() = seller_id)) OR public.can_admin_read_conversation(id)));


--
-- Name: messages Participants can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT WITH CHECK (public.is_conversation_participant(conversation_id));


--
-- Name: messages Participants can update message read status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update message read status" ON public.messages FOR UPDATE TO authenticated USING (public.is_conversation_participant(conversation_id)) WITH CHECK (public.is_conversation_participant(conversation_id));


--
-- Name: conversations Participants can update own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update own conversations" ON public.conversations FOR UPDATE TO authenticated USING ((((auth.uid() = buyer_id) OR (auth.uid() = seller_id)) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK ((((auth.uid() = buyer_id) OR (auth.uid() = seller_id)) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: conversation_ratings Ratings are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ratings are publicly readable" ON public.conversation_ratings FOR SELECT USING (true);


--
-- Name: reports Reporters can attach evidence to own reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reporters can attach evidence to own reports" ON public.reports FOR UPDATE TO authenticated USING (((reporter_id = auth.uid()) AND (status = 'pending'::public.report_status) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK (((reporter_id = auth.uid()) AND (status = 'pending'::public.report_status) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: seller_profiles Seller profiles are public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seller profiles are public" ON public.seller_profiles FOR SELECT USING (true);


--
-- Name: food_requests Users can create food requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create food requests" ON public.food_requests FOR INSERT TO authenticated WITH CHECK (((requester_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notes_requests Users can create notes requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create notes requests" ON public.notes_requests FOR INSERT TO authenticated WITH CHECK (((requester_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: profiles Users can create own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: user_roles Users can create own role row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own role row" ON public.user_roles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: seller_profiles Users can create own seller profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own seller profile" ON public.seller_profiles FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: reports Users can create reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (((reporter_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notes_assets Users can delete assets for own notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete assets for own notes listings" ON public.notes_assets FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.notes_listings nl
  WHERE ((nl.id = notes_assets.listing_id) AND (nl.seller_id = auth.uid())))));


--
-- Name: food_images Users can delete images for own food listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete images for own food listings" ON public.food_images FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.food_listings fl
  WHERE ((fl.id = food_images.food_listing_id) AND (fl.seller_id = auth.uid())))));


--
-- Name: product_images Users can delete images for their own listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete images for their own listings" ON public.product_images FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.product_listings pl
  WHERE ((pl.id = product_images.product_id) AND (pl.seller_id = auth.uid())))));


--
-- Name: rental_images Users can delete images for their own rentals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete images for their own rentals" ON public.rental_images FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.rental_listings rl
  WHERE ((rl.id = rental_images.rental_id) AND (rl.seller_id = auth.uid())))));


--
-- Name: food_listings Users can delete own food listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own food listings" ON public.food_listings FOR DELETE TO authenticated USING ((seller_id = auth.uid()));


--
-- Name: notes_listings Users can delete own notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notes listings" ON public.notes_listings FOR DELETE TO authenticated USING ((seller_id = auth.uid()));


--
-- Name: product_listings Users can delete own product listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own product listings" ON public.product_listings FOR DELETE TO authenticated USING ((seller_id = auth.uid()));


--
-- Name: rental_listings Users can delete own rental listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own rental listings" ON public.rental_listings FOR DELETE TO authenticated USING ((seller_id = auth.uid()));


--
-- Name: notes_assets Users can insert assets for own notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert assets for own notes listings" ON public.notes_assets FOR INSERT TO authenticated WITH CHECK (((NOT public.is_user_currently_banned(auth.uid())) AND (EXISTS ( SELECT 1
   FROM public.notes_listings nl
  WHERE ((nl.id = notes_assets.listing_id) AND (nl.seller_id = auth.uid()))))));


--
-- Name: feedback Users can insert feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: food_images Users can insert images for own food listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert images for own food listings" ON public.food_images FOR INSERT TO authenticated WITH CHECK (((NOT public.is_user_currently_banned(auth.uid())) AND (EXISTS ( SELECT 1
   FROM public.food_listings fl
  WHERE ((fl.id = food_images.food_listing_id) AND (fl.seller_id = auth.uid()))))));


--
-- Name: product_images Users can insert images for their own listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert images for their own listings" ON public.product_images FOR INSERT TO authenticated WITH CHECK (((NOT public.is_user_currently_banned(auth.uid())) AND (EXISTS ( SELECT 1
   FROM public.product_listings pl
  WHERE ((pl.id = product_images.product_id) AND (pl.seller_id = auth.uid()))))));


--
-- Name: rental_images Users can insert images for their own rentals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert images for their own rentals" ON public.rental_images FOR INSERT TO authenticated WITH CHECK (((NOT public.is_user_currently_banned(auth.uid())) AND (EXISTS ( SELECT 1
   FROM public.rental_listings rl
  WHERE ((rl.id = rental_images.rental_id) AND (rl.seller_id = auth.uid()))))));


--
-- Name: food_listings Users can insert own food listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own food listings" ON public.food_listings FOR INSERT TO authenticated WITH CHECK (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notes_listings Users can insert own notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own notes listings" ON public.notes_listings FOR INSERT TO authenticated WITH CHECK (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: product_listings Users can insert own product listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own product listings" ON public.product_listings FOR INSERT TO authenticated WITH CHECK (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: rental_listings Users can insert own rental listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own rental listings" ON public.rental_listings FOR INSERT TO authenticated WITH CHECK (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notes_assets Users can read assets for available or own notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read assets for available or own notes listings" ON public.notes_assets FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.notes_listings nl
  WHERE ((nl.id = notes_assets.listing_id) AND ((nl.status = 'available'::public.notes_status) OR (nl.seller_id = auth.uid()))))));


--
-- Name: notes_listings Users can read available or own notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read available or own notes listings" ON public.notes_listings FOR SELECT TO authenticated USING (((status = 'available'::public.notes_status) OR (seller_id = auth.uid())));


--
-- Name: product_listings Users can read available or own product listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read available or own product listings" ON public.product_listings FOR SELECT TO authenticated USING (((status = 'available'::public.product_status) OR (seller_id = auth.uid())));


--
-- Name: rental_listings Users can read available or own rental listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read available or own rental listings" ON public.rental_listings FOR SELECT TO authenticated USING (((status = 'available'::public.rental_status) OR (seller_id = auth.uid())));


--
-- Name: food_listings Users can read available/non-expired or own food listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read available/non-expired or own food listings" ON public.food_listings FOR SELECT TO authenticated USING ((((status = 'available'::public.food_listing_status) AND (expiry_date >= CURRENT_DATE)) OR (seller_id = auth.uid())));


--
-- Name: product_images Users can read images for available or own listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read images for available or own listings" ON public.product_images FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.product_listings pl
  WHERE ((pl.id = product_images.product_id) AND ((pl.status = 'available'::public.product_status) OR (pl.seller_id = auth.uid()))))));


--
-- Name: rental_images Users can read images for available or own rentals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read images for available or own rentals" ON public.rental_images FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.rental_listings rl
  WHERE ((rl.id = rental_images.rental_id) AND ((rl.status = 'available'::public.rental_status) OR (rl.seller_id = auth.uid()))))));


--
-- Name: food_images Users can read images for available/non-expired or own food lis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read images for available/non-expired or own food lis" ON public.food_images FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.food_listings fl
  WHERE ((fl.id = food_images.food_listing_id) AND (((fl.status = 'available'::public.food_listing_status) AND (fl.expiry_date >= CURRENT_DATE)) OR (fl.seller_id = auth.uid()))))));


--
-- Name: food_requests Users can read open or own food requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read open or own food requests" ON public.food_requests FOR SELECT TO authenticated USING (((status = 'open'::public.food_request_status) OR (requester_id = auth.uid())));


--
-- Name: notes_requests Users can read open or own notes requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read open or own notes requests" ON public.notes_requests FOR SELECT TO authenticated USING (((status = 'open'::public.notes_request_status) OR (requester_id = auth.uid())));


--
-- Name: notification_preferences Users can read own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own notification preferences" ON public.notification_preferences FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications Users can read own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: reports Users can read own reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own reports" ON public.reports FOR SELECT TO authenticated USING ((reporter_id = auth.uid()));


--
-- Name: food_listings Users can update own food listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own food listings" ON public.food_listings FOR UPDATE TO authenticated USING (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: food_requests Users can update own food requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own food requests" ON public.food_requests FOR UPDATE TO authenticated USING (((requester_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK (((requester_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notes_listings Users can update own notes listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notes listings" ON public.notes_listings FOR UPDATE TO authenticated USING (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notes_requests Users can update own notes requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notes requests" ON public.notes_requests FOR UPDATE TO authenticated USING (((requester_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK (((requester_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notification_preferences Users can update own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_presence Users can update own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own presence" ON public.user_presence FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: product_listings Users can update own product listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own product listings" ON public.product_listings FOR UPDATE TO authenticated USING (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: rental_listings Users can update own rental listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own rental listings" ON public.rental_listings FOR UPDATE TO authenticated USING (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK (((seller_id = auth.uid()) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: seller_profiles Users can update own seller profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own seller profile" ON public.seller_profiles FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (NOT public.is_user_currently_banned(auth.uid())))) WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_user_currently_banned(auth.uid()))));


--
-- Name: notification_preferences Users can upsert own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can upsert own notification preferences" ON public.notification_preferences FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_presence Users can upsert own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can upsert own presence" ON public.user_presence FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: admin_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_admin_access_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_admin_access_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: food_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.food_images ENABLE ROW LEVEL SECURITY;

--
-- Name: food_listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.food_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: food_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.food_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: food_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.food_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notes_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: notes_listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: notes_purchase_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes_purchase_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: notes_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: product_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

--
-- Name: product_listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: product_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: rental_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rental_images ENABLE ROW LEVEL SECURITY;

--
-- Name: rental_listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rental_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: rental_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: suspicious_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suspicious_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: user_presence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: wishlist_items users_manage_own_wishlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_manage_own_wishlist ON public.wishlist_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: wishlist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict ZrpzzJqBvMqZGamclv94ACAiqt0SPXERfSGLzszPxzXpLbGQ1rZUV5JKmKXUkNm

